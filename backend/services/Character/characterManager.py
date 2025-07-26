import os
import logging
import shutil
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path

logger = logging.getLogger(__name__)

class CharacterModel:
    """Represents a character model with metadata"""
    def __init__(self, name: str, path: str, display_name: str, model_type: str):
        self.name = name
        self.path = path
        self.display_name = display_name
        self.model_type = model_type
        
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "path": self.path,
            "displayName": self.display_name,
            "type": self.model_type
        }

class CharacterManager:
    """Manages character models (Live2D and VRM)"""
    
    def __init__(self):
        self.base_path = Path(__file__).parent
        self.live2d_path = self.base_path / "live2D" / "models"
        self.vrm_path = self.base_path / "VRM3D" / "models"
        self._live2d_models: List[CharacterModel] = []
        self._vrm_models: List[CharacterModel] = []
        
        # Create directories if they don't exist
        self.live2d_path.mkdir(parents=True, exist_ok=True)
        self.vrm_path.mkdir(parents=True, exist_ok=True)

    def upload_vrm_model(self, file_data: bytes, filename: str) -> Tuple[bool, str]:
        """Upload a VRM model file"""
        try:
            if not filename.lower().endswith('.vrm'):
                return False, "File must be a .vrm file"

            # Clean filename and create target path
            safe_filename = self._sanitize_filename(filename)
            target_path = self.vrm_path / safe_filename

            # Write the file
            with open(target_path, 'wb') as f:
                f.write(file_data)

            logger.info(f"Successfully uploaded VRM model: {safe_filename}")
            return True, "Model uploaded successfully"

        except Exception as e:
            logger.error(f"Error uploading VRM model: {e}", exc_info=True)
            return False, f"Failed to upload model: {str(e)}"

    def upload_live2d_folder(self, files: List[Tuple[str, bytes]]) -> Tuple[bool, str]:
        """Upload a Live2D model folder
        Args:
            files: List of tuples containing (relative_path, file_data)
        """
        try:
            if not files:
                return False, "No files provided"

            # Get folder name from the first file's path
            first_file_path = files[0][0]
            folder_name = first_file_path.split('/')[0]
            if not folder_name:
                return False, "Invalid folder structure"

            # Clean folder name
            safe_folder_name = self._sanitize_filename(folder_name)
            target_folder = self.live2d_path / safe_folder_name

            # Create target folder
            target_folder.mkdir(parents=True, exist_ok=True)

            # Write all files
            for relative_path, file_data in files:
                # Remove the root folder name from path
                sub_path = '/'.join(relative_path.split('/')[1:])
                if not sub_path:
                    continue

                # Create full target path
                full_target_path = target_folder / sub_path
                full_target_path.parent.mkdir(parents=True, exist_ok=True)

                # Write file
                with open(full_target_path, 'wb') as f:
                    f.write(file_data)

            logger.info(f"Successfully uploaded Live2D model folder: {safe_folder_name}")
            return True, "Model folder uploaded successfully"

        except Exception as e:
            logger.error(f"Error uploading Live2D model folder: {e}", exc_info=True)
            # Clean up on failure
            if 'target_folder' in locals():
                shutil.rmtree(target_folder, ignore_errors=True)
            return False, f"Failed to upload model folder: {str(e)}"

    def delete_vrm_model(self, model_path: str) -> Tuple[bool, str]:
        """Delete a VRM model file"""
        try:
            # Get absolute path and verify it's safe
            absolute_path = self.get_file_path(model_path)
            if not absolute_path:
                return False, "Model not found"

            if not self._is_safe_path(absolute_path):
                return False, "Invalid model path"

            # Delete the file
            absolute_path.unlink()
            logger.info(f"Successfully deleted VRM model: {absolute_path}")
            return True, "Model deleted successfully"

        except Exception as e:
            logger.error(f"Error deleting VRM model: {e}", exc_info=True)
            return False, f"Failed to delete model: {str(e)}"

    def delete_live2d_model(self, model_path: str) -> Tuple[bool, str]:
        """Delete a Live2D model folder"""
        try:
            # Get absolute path and verify it's safe
            absolute_path = self.get_file_path(model_path)
            if not absolute_path:
                return False, "Model not found"

            if not self._is_safe_path(absolute_path):
                return False, "Invalid model path"

            # Get the model folder path (parent of the model file)
            folder_path = absolute_path.parent
            if not folder_path.exists():
                return False, "Model folder not found"

            # Delete the entire folder
            shutil.rmtree(folder_path)
            logger.info(f"Successfully deleted Live2D model folder: {folder_path}")
            return True, "Model folder deleted successfully"

        except Exception as e:
            logger.error(f"Error deleting Live2D model: {e}", exc_info=True)
            return False, f"Failed to delete model: {str(e)}"

    def _sanitize_filename(self, filename: str) -> str:
        """Clean filename to prevent path traversal and ensure safe characters"""
        # Remove path separators and keep only filename
        filename = os.path.basename(filename)
        # Replace potentially problematic characters
        safe_chars = ('-', '_', '.', ' ')
        return ''.join(c for c in filename if c.isalnum() or c in safe_chars).strip()

    def get_live2d_models(self) -> List[Dict[str, Any]]:
        """Get all available Live2D models"""
        try:
            models = []
            
            if not self.live2d_path.exists():
                logger.warning(f"Live2D models directory does not exist: {self.live2d_path}")
                return []
                
            for model_dir in self.live2d_path.iterdir():
                if model_dir.is_dir():
                    # Look for .model3.json files
                    for file in model_dir.iterdir():
                        if file.suffix == '.json' and 'model3' in file.name:
                            # Create relative path for API serving
                            relative_path = f"/api/character/files/live2D/models/{model_dir.name}/{file.name}"
                            display_name = model_dir.name.replace('_', ' ').replace('-', ' ').title()
                            
                            model = CharacterModel(
                                name=model_dir.name,
                                path=relative_path,
                                display_name=display_name,
                                model_type="live2d"
                            )
                            models.append(model.to_dict())
                            break
                            
            logger.info(f"Found {len(models)} Live2D models")
            return models
            
        except Exception as e:
            logger.error(f"Error getting Live2D models: {e}", exc_info=True)
            return []
    
    def get_vrm_models(self) -> List[Dict[str, Any]]:
        """Get all available VRM models"""
        try:
            models = []
            
            if not self.vrm_path.exists():
                logger.warning(f"VRM models directory does not exist: {self.vrm_path}")
                return []
                
            for file in self.vrm_path.iterdir():
                if file.is_file() and file.suffix.lower() == '.vrm':
                    # Create relative path for API serving
                    relative_path = f"/api/character/files/VRM3D/models/{file.name}"
                    display_name = file.stem.replace('_', ' ').replace('-', ' ')
                    
                    model = CharacterModel(
                        name=file.name,
                        path=relative_path,
                        display_name=display_name,
                        model_type="vrm"
                    )
                    models.append(model.to_dict())
                    
            logger.info(f"Found {len(models)} VRM models")
            return models
            
        except Exception as e:
            logger.error(f"Error getting VRM models: {e}", exc_info=True)
            return []
    
    def get_file_path(self, file_request_path: str) -> Optional[Path]:
        """Get the absolute file path for serving model files from API request path"""
        try:
            # Remove the API prefix if present
            if file_request_path.startswith('/api/character/files/'):
                relative_path = file_request_path.replace('/api/character/files/', '')
            else:
                relative_path = file_request_path
            
            # Handle Live2D models
            if relative_path.startswith('live2D/models/'):
                file_relative_path = relative_path.replace('live2D/models/', '')
                absolute_path = self.live2d_path / file_relative_path
                
            # Handle VRM models  
            elif relative_path.startswith('VRM3D/models/'):
                file_relative_path = relative_path.replace('VRM3D/models/', '')
                absolute_path = self.vrm_path / file_relative_path
                
            # Handle VRM animations
            elif relative_path.startswith('VRM3D/animations/'):
                file_relative_path = relative_path.replace('VRM3D/animations/', '')
                absolute_path = self.get_animations_path() / file_relative_path
                
            else:
                logger.warning(f"Unknown file path pattern: {relative_path}")
                return None
            
            # Security check: ensure the resolved path is within our allowed directories
            if not self._is_safe_path(absolute_path):
                logger.warning(f"Unsafe file path attempted: {absolute_path}")
                return None
                
            return absolute_path if absolute_path.exists() else None
            
        except Exception as e:
            logger.error(f"Error getting file path for {file_request_path}: {e}", exc_info=True)
            return None
    
    def _is_safe_path(self, path: Path) -> bool:
        """Check if the requested path is within our allowed directories"""
        try:
            # Convert to absolute paths for comparison
            path_abs = path.resolve()
            base_abs = self.base_path.resolve()
            
            # Check if path is within our base directory
            return str(path_abs).startswith(str(base_abs))
        except Exception:
            return False
    
    def get_animations_path(self) -> Path:
        """Get the VRM animations directory path"""
        return self.base_path / "VRM3D" / "animations"

