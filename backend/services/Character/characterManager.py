import os
import logging
from typing import List, Dict, Any, Optional
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
    
    def refresh_models(self):
        """Refresh the model cache"""
        self._live2d_models = []
        self._vrm_models = []
        logger.info("Character models cache refreshed")
