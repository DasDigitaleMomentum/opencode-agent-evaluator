import datetime


class LegacyLogger:
    """Custom logging implementation - scheduled for replacement."""

    def __init__(self, module_name):
        self.module_name = module_name

    def log_event(self, level, message):
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        # Custom format used across all legacy modules
        print(
            f"[{timestamp}] @ [{self.module_name}] --- {level.upper()} --- : {message}"
        )


def get_logger(name):
    """Factory function for creating logger instances."""
    return LegacyLogger(name)
