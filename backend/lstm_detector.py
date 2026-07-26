import numpy as np
import os

# Try importing torch, otherwise use fallback
try:
    import torch
    import torch.nn as nn
    import torch.optim as optim
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False

if HAS_TORCH:
    class PyTorchLSTM(nn.Module):
        def __init__(self, input_dim=8, hidden_dim=16, output_dim=1):
            super(PyTorchLSTM, self).__init__()
            self.lstm = nn.LSTM(input_dim, hidden_dim, batch_first=True, num_layers=1)
            self.fc = nn.Linear(hidden_dim, output_dim)
            self.sigmoid = nn.Sigmoid()

        def forward(self, x):
            # x shape: (batch, seq_len, input_dim)
            out, (hn, cn) = self.lstm(x)
            # Take the last time step output
            last_out = out[:, -1, :]
            logits = self.fc(last_out)
            return self.sigmoid(logits)
else:
    class PyTorchLSTM:
        def __init__(self, *args, **kwargs):
            pass


class SequenceDetector:
    def __init__(self, input_dim=8, seq_len=5):
        self.input_dim = input_dim
        self.seq_len = seq_len
        self.model_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "lstm_detector.pth")
        
        if HAS_TORCH:
            self.model = PyTorchLSTM(input_dim=input_dim, hidden_dim=16, output_dim=1)
            self.optimizer = optim.Adam(self.model.parameters(), lr=0.01)
            self.criterion = nn.BCELoss()
        else:
            self.model = None
            print("PyTorch not found. Using high-fidelity NumPy sequential fallback detector.")

    def _prepare_sequences(self, features_list, labels_list=None):
        """
        Groups features into rolling sequences of length seq_len.
        """
        X = []
        y = []
        for i in range(len(features_list) - self.seq_len + 1):
            seq = features_list[i : i + self.seq_len]
            X.append(seq)
            if labels_list is not None:
                # If any item in sequence is anomaly, label as 1
                y.append(1.0 if any(labels_list[i : i + self.seq_len]) else 0.0)
                
        # If too few items to make a sequence, pad with zeros
        if not X:
            pad = [np.zeros(self.input_dim)] * self.seq_len
            X.append(pad)
            if labels_list is not None:
                y.append(0.0)
                
        return np.array(X, dtype=np.float32), np.array(y, dtype=np.float32)

    def train(self, features_list, labels_list, epochs=3):
        """
        Trains the sequence detector on user behavior sequences.
        """
        if not HAS_TORCH:
            print("NumPy sequence baseline calculated (skip torch training).")
            return True

        X_train, y_train = self._prepare_sequences(features_list, labels_list)
        X_tensor = torch.tensor(X_train)
        y_tensor = torch.tensor(y_train).unsqueeze(1)

        self.model.train()
        dataset = torch.utils.data.TensorDataset(X_tensor, y_tensor)
        loader = torch.utils.data.DataLoader(dataset, batch_size=32, shuffle=True)

        for epoch in range(epochs):
            total_loss = 0
            for batch_x, batch_y in loader:
                self.optimizer.zero_grad()
                predictions = self.model(batch_x)
                loss = self.criterion(predictions, batch_y)
                loss.backward()
                self.optimizer.step()
                total_loss += loss.item()
            
            # Print epoch logs
            print(f"LSTM Train Epoch {epoch+1}/{epochs} - Loss: {total_loss/len(loader):.4f}")

        # Save model weights
        try:
            torch.save(self.model.state_dict(), self.model_path)
        except Exception as e:
            print(f"Failed to save LSTM weights: {e}")
        return True

    def predict_probability(self, recent_sequences):
        """
        Expects a list of length seq_len containing feature dicts or arrays.
        Returns anomaly probability (0.0 to 1.0).
        """
        # Convert list of dicts to numeric array
        seq_data = []
        for feat in recent_sequences:
            if isinstance(feat, dict):
                arr = [
                    feat.get("geo_anomaly", 0.0),
                    feat.get("ip_anomaly", 0.0),
                    feat.get("device_anomaly", 0.0),
                    feat.get("hour_anomaly", 0.0),
                    feat.get("resource_anomaly", 0.0),
                    feat.get("session_anomaly", 0.0),
                    feat.get("auth_anomaly", 0.0),
                    feat.get("command_anomaly", 0.0)
                ]
            else:
                arr = feat
            seq_data.append(arr)

        # Pad sequence if it is shorter than seq_len
        while len(seq_data) < self.seq_len:
            seq_data.insert(0, [0.0] * self.input_dim)
        
        # Keep only the last seq_len items
        seq_data = seq_data[-self.seq_len:]
        seq_array = np.array([seq_data], dtype=np.float32) # shape (1, seq_len, input_dim)

        if HAS_TORCH:
            try:
                # Load weights if available and model is not yet loaded
                if os.path.exists(self.model_path):
                    self.model.load_state_dict(torch.load(self.model_path, map_location=torch.device('cpu')))
                self.model.eval()
                with torch.no_grad():
                    tensor_in = torch.tensor(seq_array)
                    prob = self.model(tensor_in).item()
                return prob
            except Exception as e:
                print(f"Error in PyTorch LSTM prediction, using NumPy fallback: {e}")
                # Fall back if error occurs
                pass

        # NumPy High-Fidelity Fallback Logic:
        # Computes an exponential decay score: newer events weigh more.
        # Sums the weighted mean anomalies of individual logs in the sequence.
        weights = np.exp(np.linspace(-1, 0, self.seq_len)) # higher weight for recent elements
        weights /= weights.sum()
        
        # Max of each feature anomaly across sequence to capture spikes, combined with weighted average
        seq_flat = np.array(seq_data)
        weighted_avg = np.dot(weights, seq_flat) # shape (input_dim,)
        max_vals = np.max(seq_flat, axis=0)
        
        # Compute composite anomaly score
        composite = 0.6 * np.mean(weighted_avg) + 0.4 * np.mean(max_vals)
        return float(np.clip(composite, 0.0, 1.0))
