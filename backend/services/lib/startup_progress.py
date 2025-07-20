import time
from .LAV_logger import logger

class StartupProgress:
    def __init__(self):
        self.current_step = 0
        self.total_steps = 4  # 1 import step + 5 main steps
        self.current_message = ""
        self.step_start_time = None
        
    def show_step(self, text):
        self.current_step += 1
        self.current_message = text
        progress = f"[{self.current_step}/{self.total_steps}]"
        
        # Show step start immediately without spinner to avoid interfering with other logs
        logger.info(f"{progress} {text}...")
        self.step_start_time = time.time()
        
    def complete_step(self, success_message=None):
        # Show completion via logger
        progress = f"[{self.current_step}/{self.total_steps}]"
        if success_message:
            logger.info(f"{progress} {success_message}")
        else:
            logger.info(f"{progress} {self.current_message} ✓")
            
    def show_immediate(self, text):
        """Show a step immediately and increment counter - for import step"""
        self.current_step += 1
        logger.info(f"[{self.current_step}/{self.total_steps}] {text}...")

# Create singleton instance
startup_progress = StartupProgress() 