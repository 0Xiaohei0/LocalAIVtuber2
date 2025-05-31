import os
import json
import shutil
import sys

# Add the backend directory to the Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(os.path.dirname(current_dir))
sys.path.append(backend_dir)

from services.lib.LAV_logger import logger

def migrate_models():
    """Migrate models from old structure to new folder-based structure"""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    models_dir = os.path.join(current_dir, "Models")
    model_data_path = os.path.join(current_dir, "model_data.json")

    if not os.path.exists(model_data_path):
        logger.error("model_data.json not found. Nothing to migrate.")
        return

    # Load model data
    with open(model_data_path, 'r') as f:
        model_data = json.load(f)

    # Create Models directory if it doesn't exist
    if not os.path.exists(models_dir):
        os.makedirs(models_dir)

    # Migrate each model
    for model_info in model_data:
        model_name = model_info["fileName"]
        model_folder = os.path.join(models_dir, os.path.splitext(model_name)[0])
        
        # Create model folder
        if not os.path.exists(model_folder):
            os.makedirs(model_folder)

        # Move model file
        old_model_path = os.path.join(models_dir, model_name)
        new_model_path = os.path.join(model_folder, model_name)
        if os.path.exists(old_model_path) and not os.path.exists(new_model_path):
            logger.info(f"Moving {model_name} to its folder...")
            shutil.move(old_model_path, new_model_path)

        # Move mmproj file if it exists (for vision models)
        if model_info.get("type") == "vision" and model_info.get("mmproj_path"):
            old_mmproj_path = os.path.join(models_dir, model_info["mmproj_path"])
            new_mmproj_path = os.path.join(model_folder, model_info["mmproj_path"])
            if os.path.exists(old_mmproj_path) and not os.path.exists(new_mmproj_path):
                logger.info(f"Moving {model_info['mmproj_path']} to model folder...")
                shutil.move(old_mmproj_path, new_mmproj_path)

        # Create metadata.json
        metadata_path = os.path.join(model_folder, "metadata.json")
        if not os.path.exists(metadata_path):
            logger.info(f"Creating metadata.json for {model_name}...")
            with open(metadata_path, 'w') as f:
                json.dump(model_info, f, indent=4)

    # Remove old model_data.json
    logger.info("Removing old model_data.json...")
    os.remove(model_data_path)
    logger.info("Migration completed successfully!")

if __name__ == "__main__":
    migrate_models() 