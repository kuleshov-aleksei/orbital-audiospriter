// TypeScript 6 removed the File System Access API declarations from lib.dom.
// These ambient types mirror what Chrome implements; the interfaces they
// augment (FileSystemDirectoryHandle, FileSystemFileHandle, Window) still
// exist in lib.dom.

interface FileSystemPermissionDescriptor {
  mode?: "read" | "readwrite"
}

interface DirectoryPickerOptions {
  id?: string
  mode?: "read" | "readwrite"
}

interface FileSystemHandle {
  queryPermission(descriptor?: FileSystemPermissionDescriptor): Promise<PermissionState>
  requestPermission(descriptor?: FileSystemPermissionDescriptor): Promise<PermissionState>
}

interface Window {
  showDirectoryPicker(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>
}
