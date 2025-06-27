import React from 'react';
import { DataRoomFile } from '@/lib/api';

interface FileTableProps {
  files: DataRoomFile[];
  isLoading: boolean;
  selectedFiles: string[];
  onSelectionChange: (files: string[]) => void;
  onFileClick: (file: DataRoomFile) => void;
}

export function FileTable({ 
  files, 
  isLoading, 
  selectedFiles, 
  onSelectionChange, 
  onFileClick 
}: FileTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-500">Loading files...</div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted-50 dark:bg-muted-800">
            <tr>
              <th className="p-3 text-left text-sm font-medium text-muted-700">
                <input type="checkbox" />
              </th>
              <th className="p-3 text-left text-sm font-medium text-muted-700">Name</th>
              <th className="p-3 text-left text-sm font-medium text-muted-700">Size</th>
              <th className="p-3 text-left text-sm font-medium text-muted-700">Modified</th>
              <th className="p-3 text-left text-sm font-medium text-muted-700">Owner</th>
            </tr>
          </thead>
          <tbody>
            {files.map((file) => (
              <tr 
                key={file.id}
                className="border-t border-muted-200 hover:bg-muted-50 cursor-pointer"
                onClick={() => onFileClick(file)}
              >
                <td className="p-3">
                  <input type="checkbox" />
                </td>
                <td className="p-3 text-sm">{file.name}</td>
                <td className="p-3 text-sm text-muted-600">{file.size} bytes</td>
                <td className="p-3 text-sm text-muted-600">
                  {new Date(file.lastModified).toLocaleDateString()}
                </td>
                <td className="p-3 text-sm text-muted-600">{file.owner}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}