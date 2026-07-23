import json
import time
from pathlib import Path
from src.config import DATA_DIR

COOLDOWN_FILE = DATA_DIR / "cooldown_state.json"

# Cooldown durations in seconds
COOLDOWN_DURATIONS = {
    "incremental": 180,    # 3 minutes for live location/activity pulls
    "bulk": 86400         # 24 hours for full classification GZIP pulls
}

class CooldownManager:
    def __init__(self):
        self.state_file = COOLDOWN_FILE
        self._load_state()

    def _load_state(self) -> dict:
        if self.state_file.exists():
            try:
                self.state = json.loads(self.state_file.read_text(encoding="utf-8"))
            except Exception:
                self.state = {}
        else:
            self.state = {}
        return self.state

    def _save_state(self):
        try:
            self.state_file.write_text(json.dumps(self.state, indent=2), encoding="utf-8")
        except Exception as e:
            print(f"Warning: Failed to save cooldown state: {e}")

    def get_remaining_cooldown(self, action_type: str) -> float:
        """
        Return the remaining cooldown in seconds for a given action type.
        Returns 0.0 if the cooldown has expired or has not been recorded.
        """
        self._load_state()
        last_time = self.state.get(action_type, 0.0)
        cooldown_duration = COOLDOWN_DURATIONS.get(action_type, 0.0)
        
        elapsed = time.time() - last_time
        remaining = cooldown_duration - elapsed
        return max(0.0, remaining)

    def get_last_pull_time(self, action_type: str) -> float:
        """
        Get the timestamp of the last successful pull for the given action type.
        """
        self._load_state()
        return self.state.get(action_type, 0.0)

    def update_last_pull_time(self, action_type: str):
        """
        Update the timestamp of the last successful pull for the given action type.
        """
        self._load_state()
        self.state[action_type] = time.time()
        self._save_state()
