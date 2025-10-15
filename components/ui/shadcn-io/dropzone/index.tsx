'use client';

import { UploadIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';
import type { DropEvent, DropzoneOptions, FileRejection } from 'react-dropzone';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type DropzoneContextType = {
  src?: File[];
  accept?: DropzoneOptions['accept'];
  maxSize?: DropzoneOptions['maxSize'];
  minSize?: DropzoneOptions['minSize'];
  maxFiles?: DropzoneOptions['maxFiles'];
};

const renderBytes = (bytes: number) => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)}${units[unitIndex]}`;
};

const DropzoneContext = createContext<DropzoneContextType | undefined>(
  undefined
);

export type DropzoneProps = Omit<DropzoneOptions, 'onDrop'> & {
  src?: File[];
  className?: string;
  onDrop?: (
    acceptedFiles: File[],
    fileRejections: FileRejection[],
    event: DropEvent
  ) => void;
  children?: ReactNode;
};

export const Dropzone = ({
  accept,
  maxFiles = 1,
  maxSize,
  minSize,
  onDrop,
  onError,
  disabled,
  src,
  className,
  children,
  ...props
}: DropzoneProps) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept,
    maxFiles,
    maxSize,
    minSize,
    onError,
    disabled,
    onDrop: (acceptedFiles, fileRejections, event) => {
      if (fileRejections.length > 0) {
        const message = fileRejections.at(0)?.errors.at(0)?.message;
        onError?.(new Error(message));
        return;
      }

      onDrop?.(acceptedFiles, fileRejections, event);
    },
    ...props,
  });

  return (
    <DropzoneContext.Provider
      key={JSON.stringify(src)}
      value={{ src, accept, maxSize, minSize, maxFiles }}
    >
      <Button
        className={cn(
          'relative h-auto w-full flex-col overflow-hidden p-8',
          isDragActive && 'outline-none ring-1 ring-ring',
          className
        )}
        disabled={disabled}
        type="button"
        variant="outline"
        {...getRootProps()}
      >
        <input {...getInputProps()} disabled={disabled} />
        {children}
      </Button>
    </DropzoneContext.Provider>
  );
};

const useDropzoneContext = () => {
  const context = useContext(DropzoneContext);

  if (!context) {
    throw new Error('useDropzoneContext must be used within a Dropzone');
  }

  return context;
};

export type DropzoneContentProps = {
  children?: ReactNode;
  className?: string;
};

const maxLabelItems = 3;

export const DropzoneContent = ({
  children,
  className,
}: DropzoneContentProps) => {
  const { src } = useDropzoneContext();

  if (!src) {
    return null;
  }

  if (children) {
    return children;
  }

  return (
    <div className={cn('flex flex-col items-center justify-center py-2', className)}>
      <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-600 shadow-md shadow-emerald-100 mb-3">
        <UploadIcon size={24} strokeWidth={2.5} />
      </div>
      <p className="my-2 w-full truncate font-semibold text-base text-gray-900">
        {src.length > maxLabelItems
          ? `${new Intl.ListFormat('en').format(
              src.slice(0, maxLabelItems).map((file) => file.name)
            )} and ${src.length - maxLabelItems} more`
          : new Intl.ListFormat('en').format(src.map((file) => file.name))}
      </p>
      <p className="w-full text-wrap text-gray-600 text-sm">
        Drag and drop or click to replace
      </p>
    </div>
  );
};

export type DropzoneEmptyStateProps = {
  children?: ReactNode;
  className?: string;
};

export const DropzoneEmptyState = ({
  children,
  className,
}: DropzoneEmptyStateProps) => {
  const { src, accept, maxSize, minSize, maxFiles } = useDropzoneContext();

  if (src) {
    return null;
  }

  if (children) {
    return children;
  }

  let caption = '';

  if (accept) {
    caption += 'Accepts ';
    caption += new Intl.ListFormat('en').format(Object.keys(accept));
  }

  if (minSize && maxSize) {
    caption += ` between ${renderBytes(minSize)} and ${renderBytes(maxSize)}`;
  } else if (minSize) {
    caption += ` at least ${renderBytes(minSize)}`;
  } else if (maxSize) {
    caption += ` less than ${renderBytes(maxSize)}`;
  }

  return (
    <div className={cn('flex flex-col items-center justify-center py-4', className)}>
      <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-purple-100 text-blue-600 shadow-lg shadow-blue-100 mb-4">
        <UploadIcon size={28} strokeWidth={2.5} />
      </div>
      <p className="my-2 w-full truncate text-wrap font-semibold text-lg text-gray-900">
        Upload {maxFiles === 1 ? 'Your Dataset' : 'Your Files'}
      </p>
      <p className="w-full truncate text-wrap text-gray-600 text-sm font-medium">
        Drag and drop or click to browse
      </p>
      {caption && (
        <p className="text-wrap text-gray-500 text-xs mt-2 bg-gray-100 px-3 py-1 rounded-full">{caption}</p>
      )}
    </div>
  );
};
