import datetime

class LegacyLogger:
    def __init__(self, module_name):
        self.module_name = module_name

    def log_event(self, level, message):
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        # Veraltetes, kompliziertes Format
        print(f"[{timestamp}] @ [{self.module_name}] --- {level.upper()} --- : {message}")

def get_logger(name):
    return LegacyLogger(name)