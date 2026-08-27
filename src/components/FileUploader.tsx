import React, { useState, useRef } from 'react';
import { Upload, FileText, Image as ImageIcon, AlertCircle, X, CheckCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FileUploaderProps {
  onFileSelected: (file: File) => void;
  isUploading: boolean;
  uploadProgress: number;
  onCancelUpload?: () => void;
  errorMessage?: string | null;
  onClearError?: () => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  onFileSelected,
  isUploading,
  uploadProgress,
  onCancelUpload,
  errorMessage,
  onClearError
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allowedExtensions = ['pdf', 'docx', 'doc', 'jpg', 'jpeg', 'png'];
  const maxSizeBytes = 20 * 1024 * 1024; // 20MB

  const validateAndHandleFile = (file: File) => {
    if (onClearError) onClearError();

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!allowedExtensions.includes(ext)) {
      alert('Unsupported file type. Please upload PDF, DOCX, JPG or PNG.');
      return;
    }

    if (file.size > maxSizeBytes) {
      alert('File size exceeds the maximum limit of 20 MB.');
      return;
    }

    setSelectedFile(file);
    onFileSelected(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndHandleFile(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndHandleFile(e.target.files[0]);
    }
  };

  return (
    <div id="file-uploader-container" className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        id="file-input"
        className="hidden"
        accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,image/jpeg,image/png"
        onChange={handleInputChange}
      />

      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            id="upload-error-banner"
            className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-3 text-sm shadow-sm"
          >
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-red-800">Upload Issue</p>
              <p className="text-red-600 mt-0.5 text-xs sm:text-sm">{errorMessage}</p>
            </div>
            {onClearError && (
              <button
                onClick={onClearError}
                className="text-red-400 hover:text-red-700 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {!isUploading ? (
        <div
          id="upload-dropzone"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all duration-200 bg-white ${
            isDragOver
              ? 'border-blue-500 bg-blue-50/50 scale-[0.99] shadow-inner'
              : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/80 shadow-sm'
          }`}
        >
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100 shadow-sm">
            <Upload className="w-8 h-8 text-blue-600" />
          </div>

          <h3 className="text-lg font-bold text-slate-800 tracking-tight mb-1">
            Upload Your Document
          </h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
            Drag & drop from your laptop, or tap the button to select from your phone.
          </p>

          <button
            id="select-document-btn"
            type="button"
            className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-xl shadow-sm transition-all flex items-center justify-center mx-auto text-base"
          >
            <Upload className="w-5 h-5 mr-2" />
            SELECT DOCUMENT
          </button>

          <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-400">
            <span className="inline-flex items-center px-2 py-1 bg-slate-100 text-slate-600 rounded-md font-medium">
              <FileText className="w-3.5 h-3.5 mr-1 text-slate-500" /> PDF
            </span>
            <span className="inline-flex items-center px-2 py-1 bg-slate-100 text-slate-600 rounded-md font-medium">
              <FileText className="w-3.5 h-3.5 mr-1 text-blue-500" /> DOCX
            </span>
            <span className="inline-flex items-center px-2 py-1 bg-slate-100 text-slate-600 rounded-md font-medium">
              <ImageIcon className="w-3.5 h-3.5 mr-1 text-emerald-500" /> JPG / PNG
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500 font-medium">Max 20 MB</span>
          </div>
        </div>
      ) : (
        <div id="upload-progress-card" className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm text-center">
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
          </div>

          <h3 className="text-base font-semibold text-slate-800 mb-1">
            Uploading & Counting Pages...
          </h3>
          <p className="text-xs text-slate-500 truncate max-w-xs mx-auto mb-5 font-mono">
            {selectedFile?.name || 'Document'}
          </p>

          <div className="w-full bg-slate-100 rounded-full h-3 mb-3 overflow-hidden">
            <motion.div
              className="bg-blue-600 h-full rounded-full transition-all"
              initial={{ width: 0 }}
              animate={{ width: `${uploadProgress}%` }}
              transition={{ ease: 'easeOut' }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 mb-6">
            <span>Uploading safely</span>
            <span className="font-semibold text-blue-600">{uploadProgress}%</span>
          </div>

          {onCancelUpload && (
            <button
              id="cancel-upload-btn"
              type="button"
              onClick={onCancelUpload}
              className="px-4 py-2 text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors inline-flex items-center"
            >
              <X className="w-3.5 h-3.5 mr-1.5" />
              Cancel Upload
            </button>
          )}
        </div>
      )}
    </div>
  );
};
