import os
import sys
from PyQt5.QtCore import QEvent
from PyQt5.QtWidgets import QApplication, QMainWindow, QLabel, QLineEdit, QPushButton, QTextEdit
from PyQt5.QtWidgets import QGridLayout, QVBoxLayout, QWidget, QFileDialog, QStatusBar, QComboBox
import soundfile as sf

from tools.i18n.i18n import I18nAuto
i18n = I18nAuto()

from inference_webui import gpt_path, sovits_path, change_gpt_weights, change_sovits_weights, get_tts_wav


class GPTSoVITSGUI(QMainWindow):
    GPT_Path = gpt_path
    SoVITS_Path = sovits_path

    def __init__(self):
        super().__init__()

        self.setWindowTitle('⚡ NEX-ARIS AI Voice Synthesis Terminal ⚡')
        self.setGeometry(800, 450, 950, 850)
        
        # Set window icon if available and make it frameless for sci-fi look
        self.setWindowFlags(self.windowFlags() | 0x00000001)  # Keep window frame but make it minimal

        self.setStyleSheet("""
            /* Main Window & Base Widget Styling */
            QMainWindow {
                background-color: #000000;
                color: #00FFFF;
            }
            
            QWidget {
                background-color: #0a0a0a; 
                color: #00FFFF;
                font-family: 'Consolas', 'Monaco', monospace;
            }

            /* Tab Widget Styling */
            QTabWidget::pane {
                background-color: #0f0f0f;
                border: 2px solid #00FFFF;
                border-radius: 8px;
                margin-top: 5px;
            }

            QTabWidget::tab-bar {
                alignment: left;
            }

            QTabBar::tab {
                background: qlineargradient(x1: 0, y1: 0, x2: 0, y2: 1,
                    stop: 0 #004466, stop: 1 #002244);
                color: #00CCFF;
                padding: 12px 20px;
                margin-right: 2px;
                border-top-left-radius: 8px;
                border-top-right-radius: 8px;
                border: 1px solid #00FFFF;
                font-weight: bold;
            }

            QTabBar::tab:selected {
                background: qlineargradient(x1: 0, y1: 0, x2: 0, y2: 1,
                    stop: 0 #0066FF, stop: 1 #004466);
                color: #FFFFFF;
                box-shadow: 0 0 15px #00FFFF;
            }

            QTabBar::tab:hover {
                background: qlineargradient(x1: 0, y1: 0, x2: 0, y2: 1,
                    stop: 0 #0099FF, stop: 1 #004466);
                box-shadow: 0 0 10px #00CCFF;
            }

            /* Label Styling */
            QLabel {
                color: #00FFFF;
                font-weight: bold;
                padding: 5px;
                background-color: transparent;
            }

            /* Line Edit (Input Field) Styling */
            QLineEdit {
                background-color: #001122;
                color: #00FFFF;
                border: 2px solid #004466;
                border-radius: 6px;
                padding: 8px 12px;
                font-size: 12px;
            }

            QLineEdit:focus {
                border: 2px solid #00FFFF;
                box-shadow: 0 0 10px #00FFFF;
                background-color: #001a33;
            }

            QLineEdit:hover {
                border: 2px solid #00CCFF;
                box-shadow: 0 0 5px #00CCFF;
            }

            /* Button Styling */
            QPushButton {
                background: qlineargradient(x1: 0, y1: 0, x2: 0, y2: 1,
                    stop: 0 #0066FF, stop: 1 #002244);
                color: #FFFFFF;
                padding: 12px 20px;
                border: 2px solid #00FFFF;
                border-radius: 8px;
                font-weight: bold;
                font-size: 11px;
                text-transform: uppercase;
            }

            QPushButton:hover {
                background: qlineargradient(x1: 0, y1: 0, x2: 0, y2: 1,
                    stop: 0 #00CCFF, stop: 1 #004466);
                border: 2px solid #00FFFF;
                box-shadow: 0 0 20px #00FFFF;
                color: #000000;
            }

            QPushButton:pressed {
                background: qlineargradient(x1: 0, y1: 0, x2: 0, y2: 1,
                    stop: 0 #004466, stop: 1 #001122);
                box-shadow: inset 0 0 10px #00FFFF;
            }

            QPushButton:disabled {
                background-color: #333333;
                color: #666666;
                border: 2px solid #444444;
                box-shadow: none;
            }

            /* Text Edit (Output Area) Styling */
            QTextEdit {
                background-color: #000000;
                color: #00FFFF;
                border: 2px solid #004466;
                border-radius: 8px;
                padding: 10px;
                font-family: 'Consolas', 'Monaco', monospace;
                font-size: 11px;
                selection-background-color: #0066FF;
            }

            QTextEdit:focus {
                border: 2px solid #00FFFF;
                box-shadow: 0 0 15px #00FFFF;
            }

            /* Status Bar Styling */
            QStatusBar {
                background-color: #001122;
                color: #00FFFF;
                border-top: 2px solid #004466;
                padding: 5px;
                font-weight: bold;
            }

            /* Scroll Bar Styling */
            QScrollBar:vertical {
                background-color: #001122;
                width: 15px;
                border-radius: 7px;
            }

            QScrollBar::handle:vertical {
                background-color: #004466;
                border-radius: 7px;
                border: 1px solid #00FFFF;
            }

            QScrollBar::handle:vertical:hover {
                background-color: #0066FF;
                box-shadow: 0 0 5px #00FFFF;
            }

            QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
                border: none;
                background: none;
            }

            /* Glass Morphism Effect for Main Container */
            QWidget#centralWidget {
                background: qlineargradient(x1: 0, y1: 0, x2: 1, y2: 1,
                    stop: 0 rgba(0, 255, 255, 0.1), 
                    stop: 1 rgba(0, 102, 255, 0.05));
                border-radius: 15px;
                border: 1px solid rgba(0, 255, 255, 0.3);
            }
        """)    

        license_text = (
        "⚡ NEX-ARIS AI VOICE SYNTHESIS TERMINAL ⚡\n"
        "© MIT Licensed - Neural Voice Synthesis System\n" 
        "Users assume full responsibility for generated audio content.\n"
        "Unauthorized usage of voice models is prohibited. See LICENSE for details.")
        license_label = QLabel(license_text)
        license_label.setWordWrap(True)
        license_label.setStyleSheet("""
            QLabel {
                background-color: rgba(0, 102, 255, 0.1);
                border: 1px solid #00FFFF;
                border-radius: 8px;
                padding: 10px;
                font-size: 10px;
                color: #00CCFF;
                text-align: center;
            }
        """)

        self.GPT_model_label = QLabel("🧠 NEURAL LANGUAGE PROCESSOR:")
        self.GPT_model_input = QLineEdit()
        self.GPT_model_input.setPlaceholderText("▶ Drag & Drop Neural Model File or Browse...")
        self.GPT_model_input.setText(self.GPT_Path)
        self.GPT_model_input.setReadOnly(True)
        self.GPT_model_button = QPushButton("🔍 LOAD GPT MODEL")
        self.GPT_model_button.clicked.connect(self.select_GPT_model)

        self.SoVITS_model_label = QLabel("🎵 VOICE SYNTHESIS ENGINE:")
        self.SoVITS_model_input = QLineEdit()
        self.SoVITS_model_input.setPlaceholderText("▶ Drag & Drop Voice Model File or Browse...")
        self.SoVITS_model_input.setText(self.SoVITS_Path)
        self.SoVITS_model_input.setReadOnly(True)
        self.SoVITS_model_button = QPushButton("🔍 LOAD VOICE MODEL")
        self.SoVITS_model_button.clicked.connect(self.select_SoVITS_model)

        self.ref_audio_label = QLabel("🎤 REFERENCE AUDIO SAMPLE:")
        self.ref_audio_input = QLineEdit()
        self.ref_audio_input.setPlaceholderText("▶ Drag & Drop Audio File or Browse...")
        self.ref_audio_input.setReadOnly(True)
        self.ref_audio_button = QPushButton("📁 SELECT AUDIO")
        self.ref_audio_button.clicked.connect(self.select_ref_audio)

        self.ref_text_label = QLabel("📝 REFERENCE TEXT CONTENT:")
        self.ref_text_input = QLineEdit()
        self.ref_text_input.setPlaceholderText("▶ Enter text content or upload text file...")
        self.ref_text_button = QPushButton("📤 UPLOAD TEXT")
        self.ref_text_button.clicked.connect(self.upload_ref_text)

        self.ref_language_label = QLabel("🌐 REFERENCE LANGUAGE:")
        self.ref_language_combobox = QComboBox()
        self.ref_language_combobox.addItems(["中文", "English", "日本語", "中英混合", "日英混合", "多语种混合"])
        self.ref_language_combobox.setCurrentText("多语种混合")
        self.ref_language_combobox.setStyleSheet("""
            QComboBox {
                background-color: #001122;
                color: #00FFFF;
                border: 2px solid #004466;
                border-radius: 6px;
                padding: 8px 12px;
                font-weight: bold;
            }
            QComboBox:hover {
                border: 2px solid #00CCFF;
                box-shadow: 0 0 8px #00CCFF;
            }
            QComboBox::drop-down {
                border: none;
            }
            QComboBox::down-arrow {
                image: url(down_arrow.png);
                width: 10px;
                height: 10px;
            }
            QComboBox QAbstractItemView {
                background-color: #001122;
                color: #00FFFF;
                border: 1px solid #00FFFF;
                selection-background-color: #0066FF;
            }
        """)

        self.target_text_label = QLabel("🎯 TARGET TEXT TO SYNTHESIZE:")
        self.target_text_input = QLineEdit()
        self.target_text_input.setPlaceholderText("▶ Enter target text or upload text file...")
        self.target_text_button = QPushButton("📤 UPLOAD TEXT")
        self.target_text_button.clicked.connect(self.upload_target_text)

        self.target_language_label = QLabel("🌐 TARGET LANGUAGE:")
        self.target_language_combobox = QComboBox()
        self.target_language_combobox.addItems(["中文", "English", "日本語", "中英混合", "日英混合", "多语种混合"])
        self.target_language_combobox.setCurrentText("多语种混合")
        self.target_language_combobox.setStyleSheet(self.ref_language_combobox.styleSheet())

        self.output_label = QLabel("📁 OUTPUT DIRECTORY:")
        self.output_input = QLineEdit()
        self.output_input.setPlaceholderText("▶ Select output directory...")
        self.output_input.setReadOnly(True)
        self.output_button = QPushButton("📂 SELECT FOLDER")
        self.output_button.clicked.connect(self.select_output_path)

        self.output_text = QTextEdit()
        self.output_text.setReadOnly(True)
        self.output_text.setPlaceholderText("⚡ SYNTHESIS OUTPUT LOGS WILL APPEAR HERE ⚡\n\nStatus: Awaiting neural network initialization...")
        
        # Enhanced output text styling
        self.output_text.setStyleSheet("""
            QTextEdit {
                background-color: #000000;
                color: #00FFFF;
                border: 2px solid #004466;
                border-radius: 8px;
                padding: 15px;
                font-family: 'Consolas', 'Monaco', monospace;
                font-size: 10px;
                selection-background-color: #0066FF;
                line-height: 1.4;
            }
            QTextEdit:focus {
                border: 2px solid #00FFFF;
                box-shadow: 0 0 15px #00FFFF;
            }
        """)

        self.add_drag_drop_events([
            self.GPT_model_input,
            self.SoVITS_model_input,
            self.ref_audio_input,
            self.ref_text_input,
            self.target_text_input,
            self.output_input,
        ])

        self.synthesize_button = QPushButton("⚡ INITIATE SYNTHESIS ⚡")
        self.synthesize_button.clicked.connect(self.synthesize)
        self.synthesize_button.setStyleSheet("""
            QPushButton {
                background: qlineargradient(x1: 0, y1: 0, x2: 0, y2: 1,
                    stop: 0 #00FFFF, stop: 1 #0066FF);
                color: #000000;
                padding: 15px 30px;
                border: 3px solid #00FFFF;
                border-radius: 10px;
                font-weight: bold;
                font-size: 14px;
                text-transform: uppercase;
            }
            QPushButton:hover {
                background: qlineargradient(x1: 0, y1: 0, x2: 0, y2: 1,
                    stop: 0 #FFFFFF, stop: 1 #00FFFF);
                border: 3px solid #FFFFFF;
                box-shadow: 0 0 25px #00FFFF;
                color: #000000;
            }
            QPushButton:pressed {
                background: qlineargradient(x1: 0, y1: 0, x2: 0, y2: 1,
                    stop: 0 #004466, stop: 1 #001122);
                box-shadow: inset 0 0 15px #00FFFF;
                color: #00FFFF;
            }
        """)

        self.clear_output_button = QPushButton("🗑️ CLEAR TERMINAL")
        self.clear_output_button.clicked.connect(self.clear_output)
        self.clear_output_button.setStyleSheet("""
            QPushButton {
                background: qlineargradient(x1: 0, y1: 0, x2: 0, y2: 1,
                    stop: 0 #FF6600, stop: 1 #CC3300);
                color: #FFFFFF;
                padding: 10px 20px;
                border: 2px solid #FF6600;
                border-radius: 8px;
                font-weight: bold;
                font-size: 11px;
                text-transform: uppercase;
            }
            QPushButton:hover {
                background: qlineargradient(x1: 0, y1: 0, x2: 0, y2: 1,
                    stop: 0 #FF8833, stop: 1 #FF6600);
                border: 2px solid #FF8833;
                box-shadow: 0 0 15px #FF6600;
            }
            QPushButton:pressed {
                background: qlineargradient(x1: 0, y1: 0, x2: 0, y2: 1,
                    stop: 0 #CC3300, stop: 1 #990000);
                box-shadow: inset 0 0 10px #FF6600;
            }
        """)

        self.status_bar = QStatusBar()
        self.status_bar.showMessage("🔋 System Status: Neural Networks Ready | Voice Synthesis Engine Online")
        self.status_bar.setStyleSheet("""
            QStatusBar {
                background: qlineargradient(x1: 0, y1: 0, x2: 1, y2: 0,
                    stop: 0 #001122, stop: 1 #002244);
                color: #00FFFF;
                border-top: 2px solid #00FFFF;
                padding: 8px;
                font-weight: bold;
                font-size: 10px;
            }
        """)

        main_layout = QVBoxLayout()

        input_layout = QGridLayout(self)
        input_layout.setSpacing(10)

        input_layout.addWidget(license_label, 0, 0, 1, 3)

        input_layout.addWidget(self.GPT_model_label, 1, 0)
        input_layout.addWidget(self.GPT_model_input, 2, 0, 1, 2)
        input_layout.addWidget(self.GPT_model_button, 2, 2)

        input_layout.addWidget(self.SoVITS_model_label, 3, 0)
        input_layout.addWidget(self.SoVITS_model_input, 4, 0, 1, 2)
        input_layout.addWidget(self.SoVITS_model_button, 4, 2)

        input_layout.addWidget(self.ref_audio_label, 5, 0)
        input_layout.addWidget(self.ref_audio_input, 6, 0, 1, 2)
        input_layout.addWidget(self.ref_audio_button, 6, 2)

        input_layout.addWidget(self.ref_language_label, 7, 0)
        input_layout.addWidget(self.ref_language_combobox, 8, 0, 1, 1)
        input_layout.addWidget(self.ref_text_label, 9, 0)
        input_layout.addWidget(self.ref_text_input, 10, 0, 1, 2)
        input_layout.addWidget(self.ref_text_button, 10, 2)

        input_layout.addWidget(self.target_language_label, 11, 0)
        input_layout.addWidget(self.target_language_combobox, 12, 0, 1, 1)
        input_layout.addWidget(self.target_text_label, 13, 0)
        input_layout.addWidget(self.target_text_input, 14, 0, 1, 2)
        input_layout.addWidget(self.target_text_button, 14, 2)

        input_layout.addWidget(self.output_label, 15, 0)
        input_layout.addWidget(self.output_input, 16, 0, 1, 2)
        input_layout.addWidget(self.output_button, 16, 2)

        main_layout.addLayout(input_layout)

        output_layout = QVBoxLayout()
        output_layout.addWidget(self.output_text)
        main_layout.addLayout(output_layout)

        main_layout.addWidget(self.synthesize_button)

        main_layout.addWidget(self.clear_output_button)

        main_layout.addWidget(self.status_bar)

        self.central_widget = QWidget()
        self.central_widget.setObjectName("centralWidget")
        self.central_widget.setLayout(main_layout)
        self.setCentralWidget(self.central_widget)

    def dragEnterEvent(self, event):
        if event.mimeData().hasUrls():
            event.acceptProposedAction()

    def dropEvent(self, event):
        if event.mimeData().hasUrls():
            file_paths = [url.toLocalFile() for url in event.mimeData().urls()]
            if len(file_paths) == 1:
                self.update_ref_audio(file_paths[0])
            else:
                self.update_ref_audio(", ".join(file_paths))

    def add_drag_drop_events(self, widgets):
        for widget in widgets:
            widget.setAcceptDrops(True)
            widget.installEventFilter(self)

    def eventFilter(self, obj, event):
        if event.type() in (QEvent.DragEnter, QEvent.Drop):
            mime_data = event.mimeData()
            if mime_data.hasUrls():
                event.acceptProposedAction()

        return super().eventFilter(obj, event)

    def select_GPT_model(self):
        file_path, _ = QFileDialog.getOpenFileName(self, "选择GPT模型文件", "", "GPT Files (*.ckpt)")
        if file_path:
            self.GPT_model_input.setText(file_path)

    def select_SoVITS_model(self):
        file_path, _ = QFileDialog.getOpenFileName(self, "选择SoVITS模型文件", "", "SoVITS Files (*.pth)")
        if file_path:
            self.SoVITS_model_input.setText(file_path)

    def select_ref_audio(self):
        file_path, _ = QFileDialog.getOpenFileName(self, "选择参考音频文件", "", "Audio Files (*.wav *.mp3)")
        if file_path:
            self.update_ref_audio(file_path)

    def upload_ref_text(self):
        file_path, _ = QFileDialog.getOpenFileName(self, "选择文本文件", "", "Text Files (*.txt)")
        if file_path:
            with open(file_path, 'r', encoding='utf-8') as file:
                content = file.read()
                self.ref_text_input.setText(content)

    def upload_target_text(self):
        file_path, _ = QFileDialog.getOpenFileName(self, "选择文本文件", "", "Text Files (*.txt)")
        if file_path:
            with open(file_path, 'r', encoding='utf-8') as file:
                content = file.read()
                self.target_text_input.setText(content)

    def select_output_path(self):
        options = QFileDialog.Options()
        options |= QFileDialog.DontUseNativeDialog
        options |= QFileDialog.ShowDirsOnly

        folder_dialog = QFileDialog()
        folder_dialog.setOptions(options)
        folder_dialog.setFileMode(QFileDialog.Directory)

        if folder_dialog.exec_():
            folder_path = folder_dialog.selectedFiles()[0]
            self.output_input.setText(folder_path)

    def update_ref_audio(self, file_path):
        self.ref_audio_input.setText(file_path)

    def clear_output(self):
        self.output_text.clear()

    def synthesize(self):
        GPT_model_path = self.GPT_model_input.text()
        SoVITS_model_path = self.SoVITS_model_input.text()
        ref_audio_path = self.ref_audio_input.text()
        language_combobox = self.ref_language_combobox.currentText()
        language_combobox = i18n(language_combobox)
        ref_text = self.ref_text_input.text()
        target_language_combobox = self.target_language_combobox.currentText()
        target_language_combobox = i18n(target_language_combobox)
        target_text = self.target_text_input.text()
        output_path = self.output_input.text()

        if GPT_model_path != self.GPT_Path:
            change_gpt_weights(gpt_path=GPT_model_path)
            self.GPT_Path = GPT_model_path
        if SoVITS_model_path != self.SoVITS_Path:
            change_sovits_weights(sovits_path=SoVITS_model_path)
            self.SoVITS_Path = SoVITS_model_path

        synthesis_result = get_tts_wav(ref_wav_path=ref_audio_path, 
                                       prompt_text=ref_text, 
                                       prompt_language=language_combobox, 
                                       text=target_text, 
                                       text_language=target_language_combobox)

        result_list = list(synthesis_result)

        if result_list:
            last_sampling_rate, last_audio_data = result_list[-1]
            output_wav_path = os.path.join(output_path, "output.wav") 
            sf.write(output_wav_path, last_audio_data, last_sampling_rate)

            result = "Audio saved to " + output_wav_path

        self.status_bar.showMessage("合成完成！输出路径：" + output_wav_path, 5000)
        self.output_text.append("处理结果：\n" + result)


if __name__ == '__main__':
    app = QApplication(sys.argv)
    mainWin = GPTSoVITSGUI()
    mainWin.show()
    sys.exit(app.exec_())