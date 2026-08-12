import * as React from 'react';
import { File as FileIcon, Upload, X } from 'lucide-react';

import { cn } from '../lib/utils';
import { Badge } from './badge';
import { Progress } from './progress';

export interface FileUploadItem {
  name: string;
  sizeBytes: number;
  status: 'uploading' | 'success' | 'error';
  progress?: number;
  error?: string;
}

export interface FileUploadProps extends Omit<React.ComponentProps<'div'>, 'onDrop'> {
  accept?: string;
  multiple?: boolean;
  onFilesSelected: (files: File[]) => void;
  /** Rendered file list — the app owns the actual upload and reports progress/status back in here. */
  files?: FileUploadItem[];
  onRemove?: (name: string) => void;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * File dropzone + upload progress list.
 *
 * Used by: apps/admin (Documents, project file attachments), apps/portal
 * (Documents), Messages (attachments) in both apps.
 * Variants: none; states: idle, dragover (drag feedback), and per-file
 * uploading (progress bar)/success/error, driven by the `files` prop —
 * this component only handles selection/drag UI, the app owns the actual
 * upload and reports status back in.
 * A11y: the dropzone is a real `<label>` wrapping a visually-hidden
 * `<input type="file">`, so it's keyboard/screen-reader operable without
 * relying on drag-and-drop at all.
 * Brief v6 deviations: none — new composition. Deliberately no new
 * dependency (native drag events + a file input) rather than adding
 * `react-dropzone`, keeping this expansion dependency-lean per the plan.
 */
function FileUpload({ accept, multiple = true, onFilesSelected, files = [], onRemove, className, ...props }: FileUploadProps) {
  const [isDragOver, setIsDragOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    onFilesSelected(Array.from(fileList));
  };

  return (
    <div data-slot="file-upload" className={cn('flex flex-col gap-3', className)} {...props}>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-8 text-center transition-colors duration-[160ms]',
          isDragOver ? 'border-primary bg-accent' : 'border-border hover:bg-muted',
        )}
      >
        <Upload className="size-6 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm font-medium">
          Drop files here, or <span className="text-primary underline">browse</span>
        </span>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="sr-only"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </label>

      {files.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {files.map((file) => (
            <li key={file.name} className="flex items-center gap-3 rounded-md border border-border p-2">
              <FileIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-medium">{file.name}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{formatSize(file.sizeBytes)}</span>
                </div>
                {file.status === 'uploading' ? <Progress value={file.progress ?? 0} /> : null}
                {file.status === 'error' ? (
                  <Badge variant="danger">{file.error ?? 'Upload failed'}</Badge>
                ) : file.status === 'success' ? (
                  <Badge variant="success">Uploaded</Badge>
                ) : null}
              </div>
              {onRemove ? (
                <button
                  type="button"
                  onClick={() => onRemove(file.name)}
                  aria-label={`Remove ${file.name}`}
                  className="shrink-0 text-muted-foreground outline-none transition-colors duration-[160ms] hover:text-destructive focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export { FileUpload };
