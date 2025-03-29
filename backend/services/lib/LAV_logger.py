import logging
import sys
from colorama import Fore, Style

# Define colors for different log levels
COLORS = {
    logging.DEBUG: Fore.BLUE,       
    logging.INFO: Fore.GREEN,       
    logging.WARNING: Fore.YELLOW,   
    logging.ERROR: Fore.RED,       
    logging.CRITICAL: Fore.MAGENTA, 
}

class CustomFormatter(logging.Formatter):
    def format(self, record):
        log_color = COLORS.get(record.levelno, Fore.WHITE)
        levelname = f"{log_color}{record.levelname}{Style.RESET_ALL}"  # Color only log level
        return f"{levelname}:     {record.getMessage()}"

logger = logging.getLogger("LAV_logger")
logger.setLevel(logging.DEBUG) 

# Ensure the logger is configured only once
if not logger.hasHandlers():
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.DEBUG)
    console_handler.setFormatter(CustomFormatter())
    logger.addHandler(console_handler)

logger.propagate = False
