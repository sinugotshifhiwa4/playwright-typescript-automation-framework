import fs from 'fs';
import path from 'path';
import {
  FileOperationOptions,
  FileOperationResult,
} from '../../config/coreTypes/fileSystem/File-system-operations.types';
import { FileEncoding } from '../../config/coreTypes/configTypes/file-encoding.enum';
import ErrorHandler from '../../utils/errors/errorHandler';
import logger from '../logging/loggerManager';

export default class FileSystemManager {
  // Default options
  private static readonly DEFAULT_OPTIONS: FileOperationOptions = {
    throwOnError: true,
    overwrite: true,
    createParentDirs: true,
  };

  /**
   * Creates a write stream for large file operations
   * Note: Ensure parent directories exist before calling this method
   * @param filePath - Path to the file
   * @param options - Stream options
   * @returns WriteStream instance
   */
  public static createWriteStream(
    filePath: string,
    options?: {
      flags?: string;
      encoding?: BufferEncoding;
      fd?: number;
      mode?: number;
      autoClose?: boolean;
      emitClose?: boolean;
      start?: number;
      highWaterMark?: number;
    },
  ): fs.WriteStream {
    filePath = this.normalizePath(filePath);
    this.validatePath(filePath);

    return fs.createWriteStream(filePath, options);
  }

  /**
   * Creates a write stream with automatic directory creation
   * @param filePath - Path to the file
   * @param options - Stream and operation options
   * @returns Promise resolving to WriteStream
   */
  public static async createWriteStreamSafe(
    filePath: string,
    options?: {
      flags?: string;
      encoding?: BufferEncoding;
      fd?: number;
      mode?: number;
      autoClose?: boolean;
      emitClose?: boolean;
      start?: number;
      highWaterMark?: number;
    } & Partial<FileOperationOptions>,
  ): Promise<fs.WriteStream> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    filePath = this.normalizePath(filePath);
    this.validatePath(filePath);

    // Ensure parent directory exists asynchronously
    const dirPath = path.dirname(filePath);
    if (opts.createParentDirs) {
      await this.createDirectory(dirPath, { throwOnError: opts.throwOnError });
    }

    return fs.createWriteStream(filePath, options);
  }

  /**
   * Checks if a path exists (file or directory)
   * @param targetPath - Path to check
   * @returns Promise resolving to boolean indicating existence
   */
  public static async pathExists(targetPath: string): Promise<boolean> {
    targetPath = this.normalizePath(targetPath);
    this.validatePath(targetPath, 'targetPath');

    try {
      await fs.promises.access(targetPath, fs.constants.F_OK);
      return true;
    } catch {
      logger.debug(`Path does not exist: ${this.getRelativePath(targetPath)}`);
      return false;
    }
  }

  /**
   * Creates directory structure recursively
   * Renamed from ensureDirectoryExists for clarity
   */
  public static async createDirectory(
    dirPath: string,
    options?: Partial<FileOperationOptions>,
  ): Promise<FileOperationResult> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    dirPath = this.normalizePath(dirPath);
    this.validatePath(dirPath, 'dirPath');

    try {
      await fs.promises.mkdir(dirPath, { recursive: true });
      logger.debug(`Created directory: ${this.getRelativePath(dirPath)}`);
      return { success: true };
    } catch (error) {
      ErrorHandler.captureError(error, 'createDirectory', `Failed to create directory: ${dirPath}`);

      if (opts.throwOnError) {
        throw error;
      }
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Creates an empty file with parent directories
   * Renamed from ensureFileExists for clarity
   */
  public static async createFile(
    filePath: string,
    options?: Partial<FileOperationOptions>,
  ): Promise<FileOperationResult> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    filePath = this.normalizePath(filePath);
    this.validatePath(filePath, 'filePath');

    try {
      // First ensure parent directory exists
      const dirPath = path.dirname(filePath);
      const dirResult = await this.createDirectory(dirPath, options);

      if (!dirResult.success) {
        return dirResult;
      }

      // Create empty file if it doesn't exist
      const fileHandle = await fs.promises.open(filePath, 'a');
      await fileHandle.close();

      logger.debug(`Created file: ${this.getRelativePath(filePath)}`);
      return { success: true };
    } catch (error) {
      ErrorHandler.captureError(error, 'createFile', `Failed to create file: ${filePath}`);

      if (opts.throwOnError) {
        throw error;
      }

      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Writes content to a file atomically, using a temporary file and atomic rename
   *
   * @param filePath - Path to the file
   * @param content - Content to write
   * @param keyName - Identifier for logging
   * @param encoding - File encoding
   * @param options - Operation options
   * @returns Promise with operation result
   */
  public static async writeFileAtomic(
    filePath: string,
    content: string,
    keyName: string,
    encoding: FileEncoding = FileEncoding.UTF8,
    options?: Partial<FileOperationOptions>,
  ): Promise<FileOperationResult> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    filePath = this.normalizePath(filePath);

    try {
      this.validatePath(filePath, 'filePath');

      if (content === undefined || content === null) {
        const error = new Error(`No content provided for file: ${keyName}`);
        logger.warn(error.message);

        if (opts.throwOnError) {
          throw error;
        }
        return { success: false, error };
      }

      const dirPath = path.dirname(filePath);
      const tempPath = `${filePath}.tmp.${Date.now()}`;

      if (opts.createParentDirs) {
        await this.createDirectory(dirPath);
      }

      // Check overwrite settings
      if (!opts.overwrite && (await this.doesFileExist(filePath))) {
        const error = new Error(`File already exists and overwrite is disabled: ${filePath}`);
        if (opts.throwOnError) throw error;
        return { success: false, error };
      }

      // Write to temporary file first
      await fs.promises.writeFile(tempPath, content, { encoding });

      // Atomic rename
      await fs.promises.rename(tempPath, filePath);

      logger.debug(`Atomically wrote file: ${this.getRelativePath(filePath)}`);
      return { success: true };
    } catch (error) {
      // Clean up temp file if it exists
      const tempPath = `${filePath}.tmp.${Date.now()}`;
      try {
        await fs.promises.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }

      ErrorHandler.captureError(
        error,
        'writeFileAtomic',
        `Failed to write file atomically: ${filePath}`,
      );

      if (opts.throwOnError) {
        throw error;
      }
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Deletes a file (renamed for clarity)
   */
  public static async deleteFile(
    filePath: string,
    options?: Partial<FileOperationOptions>,
  ): Promise<FileOperationResult> {
    return this.deleteFile(filePath, options);
  }

  /**
   * Deletes a directory (renamed for clarity)
   */
  public static async deleteDirectory(
    dirPath: string,
    options?: Partial<FileOperationOptions>,
  ): Promise<FileOperationResult> {
    return this.deleteDirectory(dirPath, options);
  }

  /**
   * Lists directory contents with detailed information
   */
  public static async listDirectoryContents(
    dirPath: string,
    options?: Partial<FileOperationOptions> & {
      includeStats?: boolean;
      recursive?: boolean;
    },
  ): Promise<
    FileOperationResult<
      Array<{ name: string; isFile: boolean; isDirectory: boolean; stats?: fs.Stats }>
    >
  > {
    const opts = { ...this.DEFAULT_OPTIONS, includeStats: false, recursive: false, ...options };
    dirPath = this.normalizePath(dirPath);
    this.validatePath(dirPath, 'dirPath');

    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      const result = [];

      for (const entry of entries) {
        const entryInfo = {
          name: entry.name,
          isFile: entry.isFile(),
          isDirectory: entry.isDirectory(),
          stats: opts.includeStats
            ? await fs.promises.stat(path.join(dirPath, entry.name))
            : undefined,
        };

        result.push(entryInfo);

        // Recursive listing for directories
        if (opts.recursive && entry.isDirectory()) {
          const subDirPath = path.join(dirPath, entry.name);
          const subResult = await this.listDirectoryContents(subDirPath, opts);
          if (subResult.success && subResult.data) {
            result.push(
              ...subResult.data.map((item) => ({
                ...item,
                name: path.join(entry.name, item.name),
              })),
            );
          }
        }
      }

      return { success: true, data: result };
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'listDirectoryContents',
        `Failed to list directory contents: ${dirPath}`,
      );

      if (opts.throwOnError) {
        throw error;
      }
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Gets file size in bytes
   */
  public static async getFileSize(
    filePath: string,
    options?: Partial<FileOperationOptions>,
  ): Promise<FileOperationResult<number>> {
    const statsResult = await this.getFileStats(filePath, options);

    if (!statsResult.success || !statsResult.data) {
      return {
        success: false,
        error: statsResult.error || new Error('Failed to get file stats'),
      };
    }

    return {
      success: true,
      data: statsResult.data.size,
    };
  }

  /**
   * Checks if path is readable
   */
  public static async isReadable(
    filePath: string,
    options?: Partial<FileOperationOptions>,
  ): Promise<FileOperationResult<boolean>> {
    const result = await this.checkAccess(filePath, fs.constants.R_OK, options);
    return {
      success: true,
      data: result.success,
    };
  }

  /**
   * Checks if path is writable
   */
  public static async isWritable(
    filePath: string,
    options?: Partial<FileOperationOptions>,
  ): Promise<FileOperationResult<boolean>> {
    const result = await this.checkAccess(filePath, fs.constants.W_OK, options);
    return {
      success: true,
      data: result.success,
    };
  }

  /**
   * Gets file extension (including the dot)
   */
  public static getFileExtension(filePath: string): string {
    return path.extname(filePath);
  }

  /**
   * Gets filename without extension
   */
  public static getBaseName(filePath: string): string {
    return path.basename(filePath, path.extname(filePath));
  }

  /**
   * Joins multiple path segments safely
   */
  public static joinPath(...segments: string[]): string {
    if (segments.length === 0) {
      throw new Error('At least one path segment is required');
    }

    const joined = path.join(...segments);
    return this.normalizePath(joined);
  }

  /**
   * Creates a read stream for large file operations
   * @param filePath - Path to the file
   * @returns ReadStream instance
   */
  public static createReadStream(filePath: string): fs.ReadStream {
    filePath = this.normalizePath(filePath);
    this.validatePath(filePath);
    return fs.createReadStream(filePath);
  }

  /**
   * Normalizes a path with security checks
   *
   * @param inputPath - The path to normalize
   * @returns Normalized absolute path
   */
  public static normalizePath(inputPath: string): string {
    if (!inputPath) {
      throw new Error('Path cannot be empty');
    }

    // Security: Check for null bytes (potential path traversal attack)
    if (inputPath.indexOf('\0') !== -1) {
      throw new Error('Path contains null bytes');
    }

    const normalizedPath = path.normalize(inputPath);

    // Convert to absolute path
    const absolutePath = path.resolve(normalizedPath);

    // Additional security check to prevent path traversal
    const cwd = process.cwd();
    if (!absolutePath.startsWith(cwd) && !path.isAbsolute(inputPath)) {
      throw new Error('Path traversal attempt detected');
    }

    return absolutePath;
  }

  /**
   * Gets a relative path from the current working directory
   *
   * @param absolutePath - The absolute path to convert
   * @returns Relative path from current working directory
   */
  public static getRelativePath(absolutePath: string): string {
    return path.relative(process.cwd(), absolutePath);
  }

  /**
   * Validates path parameters
   *
   * @param filePath - Path to validate
   * @param paramName - Parameter name for error messages
   */
  private static validatePath(filePath: string, paramName: string = 'path'): void {
    if (!filePath) {
      const message = `Invalid arguments: '${paramName}' is required.`;
      ErrorHandler.logAndThrow(message, 'validatePath');
    }

    if (paramName === 'filePath' && (filePath.endsWith('/') || filePath.endsWith('\\'))) {
      const message = `Invalid file path: '${filePath}' cannot end with a directory separator.`;
      ErrorHandler.logAndThrow(message, 'validatePath');
    }
  }

  /**
   * Checks if a directory exists
   *
   * @param dirPath - Path to the directory
   * @returns Promise resolving to boolean indicating existence
   */
  public static async doesDirectoryExist(dirPath: string): Promise<boolean> {
    dirPath = this.normalizePath(dirPath);
    this.validatePath(dirPath, 'dirPath');

    try {
      const stats = await fs.promises.stat(dirPath);
      return stats.isDirectory();
    } catch {
      logger.debug(`Directory does not exist: ${this.getRelativePath(dirPath)}`);
      return false;
    }
  }

  /**
   * Checks if a file exists
   *
   * @param filePath - Path to the file
   * @returns Promise resolving to boolean indicating existence
   */
  public static async doesFileExist(filePath: string): Promise<boolean> {
    filePath = this.normalizePath(filePath);
    this.validatePath(filePath, 'filePath');

    try {
      const stats = await fs.promises.stat(filePath);
      return stats.isFile();
    } catch {
      logger.debug(`File does not exist: ${path.basename(filePath)}`);
      return false;
    }
  }

  /**
   * Reads content from a file
   *
   * @param filePath - Path to the file
   * @param encoding - File encoding
   * @returns Promise with file content
   */
  public static async readFile(
    filePath: string,
    encoding: FileEncoding = FileEncoding.UTF8,
  ): Promise<string> {
    filePath = this.normalizePath(filePath);
    this.validatePath(filePath, 'filePath');

    try {
      const content = await fs.promises.readFile(filePath, { encoding });
      logger.debug(`Successfully loaded file: ${this.getRelativePath(filePath)}`);
      return content.toString();
    } catch (error) {
      ErrorHandler.captureError(error, 'readFile', `Failed to read file: ${filePath}`);
      throw error;
    }
  }

  /**
   * Reads a file safely, returning a result object instead of throwing
   *
   * @param filePath - Path to the file
   * @param encoding - File encoding
   * @returns Promise with operation result containing file content
   */
  public static async readFileSafe(
    filePath: string,
    encoding: FileEncoding = FileEncoding.UTF8,
  ): Promise<FileOperationResult<string>> {
    try {
      const content = await this.readFile(filePath, encoding);
      return { success: true, data: content };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Writes content to a file with improved error handling and options
   *
   * @param filePath - Path to the file
   * @param content - Content to write
   * @param keyName - Identifier for logging
   * @param encoding - File encoding
   * @param options - Operation options
   * @returns Promise with operation result
   */
  public static async writeFile(
    filePath: string,
    content: string,
    keyName: string,
    encoding: FileEncoding = FileEncoding.UTF8,
    options?: Partial<FileOperationOptions>,
  ): Promise<FileOperationResult> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    filePath = this.normalizePath(filePath);

    try {
      this.validatePath(filePath, 'filePath');

      if (content === undefined || content === null) {
        const error = new Error(`No content provided for file: ${keyName}`);
        logger.warn(error.message);

        if (opts.throwOnError) {
          throw error;
        }
        return { success: false, error };
      }

      const dirPath = path.dirname(filePath);

      if (opts.createParentDirs) {
        await this.createDirectory(dirPath);
      }

      // Check if file exists and we're not supposed to overwrite
      if (!opts.overwrite) {
        const exists = await this.doesFileExist(filePath);
        if (exists) {
          const error = new Error(`File already exists and overwrite is disabled: ${filePath}`);

          if (opts.throwOnError) {
            throw error;
          }
          return { success: false, error };
        }
      }

      await fs.promises.writeFile(filePath, content, { encoding });

      logger.debug(`Successfully wrote file: ${this.getRelativePath(filePath)}`);
      return { success: true };
    } catch (error) {
      ErrorHandler.captureError(error, 'writeFile', `Failed to write file: ${filePath}`);

      if (opts.throwOnError) {
        throw error;
      }
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Appends content to a file
   *
   * @param filePath - Path to the file
   * @param content - Content to append
   * @param encoding - File encoding
   * @param options - Operation options
   * @returns Promise with operation result
   */
  public static async appendToFile(
    filePath: string,
    content: string,
    encoding: FileEncoding = FileEncoding.UTF8,
    options?: Partial<FileOperationOptions>,
  ): Promise<FileOperationResult> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    filePath = this.normalizePath(filePath);

    try {
      this.validatePath(filePath, 'filePath');

      if (!content) {
        const error = new Error('No content provided for append operation');
        logger.warn(error.message);

        if (opts.throwOnError) {
          throw error;
        }
        return { success: false, error };
      }

      const dirPath = path.dirname(filePath);

      if (opts.createParentDirs) {
        await this.createDirectory(dirPath, { throwOnError: false });
      }

      await fs.promises.appendFile(filePath, content, { encoding });

      logger.debug(`Successfully appended to file: ${this.getRelativePath(filePath)}`);
      return { success: true };
    } catch (error) {
      ErrorHandler.captureError(error, 'appendToFile', `Failed to append to file: ${filePath}`);

      if (opts.throwOnError) {
        throw error;
      }
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Copies a file from source to destination
   *
   * @param sourcePath - Source file path
   * @param destPath - Destination file path
   * @param options - Operation options
   * @returns Promise with operation result
   */
  public static async copyFile(
    sourcePath: string,
    destPath: string,
    options?: Partial<FileOperationOptions>,
  ): Promise<FileOperationResult> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    sourcePath = this.normalizePath(sourcePath);
    destPath = this.normalizePath(destPath);

    try {
      this.validatePath(sourcePath, 'sourcePath');
      this.validatePath(destPath, 'destPath');

      // Check if source exists
      const sourceExists = await this.doesFileExist(sourcePath);
      if (!sourceExists) {
        const error = new Error(`Source file does not exist: ${sourcePath}`);

        if (opts.throwOnError) {
          throw error;
        }
        return { success: false, error };
      }

      // Check if destination exists and we're not supposed to overwrite
      if (!opts.overwrite) {
        const destExists = await this.doesFileExist(destPath);
        if (destExists) {
          const error = new Error(`Destination file already exists: ${destPath}`);

          if (opts.throwOnError) {
            throw error;
          }
          return { success: false, error };
        }
      }

      // Create destination directory if needed
      if (opts.createParentDirs) {
        const destDir = path.dirname(destPath);
        await this.createDirectory(destDir, { throwOnError: false });
      }

      await fs.promises.copyFile(
        sourcePath,
        destPath,
        opts.overwrite ? fs.constants.COPYFILE_FICLONE : fs.constants.COPYFILE_EXCL,
      );

      logger.debug(
        `Copied file from ${this.getRelativePath(sourcePath)} to ${this.getRelativePath(destPath)}`,
      );
      return { success: true };
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'copyFile',
        `Failed to copy file from ${sourcePath} to ${destPath}`,
      );

      if (opts.throwOnError) {
        throw error;
      }
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Moves a file from source to destination
   *
   * @param sourcePath - Source file path
   * @param destPath - Destination file path
   * @param options - Operation options
   * @returns Promise with operation result
   */
  public static async moveFile(
    sourcePath: string,
    destPath: string,
    options?: Partial<FileOperationOptions>,
  ): Promise<FileOperationResult> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    sourcePath = this.normalizePath(sourcePath);
    destPath = this.normalizePath(destPath);

    try {
      this.validatePath(sourcePath, 'sourcePath');
      this.validatePath(destPath, 'destPath');

      // Check if source exists
      const sourceExists = await this.doesFileExist(sourcePath);
      if (!sourceExists) {
        const error = new Error(`Source file does not exist: ${sourcePath}`);

        if (opts.throwOnError) {
          throw error;
        }
        return { success: false, error };
      }

      // Create destination directory if needed
      if (opts.createParentDirs) {
        const destDir = path.dirname(destPath);
        await this.createDirectory(destDir, { throwOnError: false });
      }

      // Try using rename for atomic move (only works on same filesystem)
      try {
        await fs.promises.rename(sourcePath, destPath);
      } catch {
        // Fallback to copy and delete if rename fails
        const copyResult = await this.copyFile(sourcePath, destPath, opts);
        if (!copyResult.success) {
          return copyResult;
        }
        await this.deleteFile(sourcePath, { throwOnError: false });
      }

      logger.debug(
        `Moved file from ${this.getRelativePath(sourcePath)} to ${this.getRelativePath(destPath)}`,
      );
      return { success: true };
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'moveFile',
        `Failed to move file from ${sourcePath} to ${destPath}`,
      );

      if (opts.throwOnError) {
        throw error;
      }
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Gets file stats
   *
   * @param filePath - Path to the file
   * @param options - Operation options
   * @returns Promise with operation result containing file stats
   */
  public static async getFileStats(
    filePath: string,
    options?: Partial<FileOperationOptions>,
  ): Promise<FileOperationResult<fs.Stats>> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    filePath = this.normalizePath(filePath);

    try {
      this.validatePath(filePath, 'filePath');
      const stats = await fs.promises.stat(filePath);
      return { success: true, data: stats };
    } catch (error) {
      ErrorHandler.captureError(error, 'getFileStats', `Failed to get file stats: ${filePath}`);

      if (opts.throwOnError) {
        throw error;
      }
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Resolves a given directory and fileName to an absolute normalized path with security checks
   *
   * @param directory - The directory path
   * @param fileName - The file or subpath to be appended to the directory
   * @returns Absolute normalized path
   */
  public static resolveFilePath(directory: string, fileName: string): string {
    if (!directory?.trim()) {
      throw new Error('Directory path cannot be empty');
    }
    if (!fileName?.trim()) {
      throw new Error('File name cannot be empty');
    }

    return path.resolve(directory, fileName);
  }

  public static getDirectoryPath(dirPath: string): string {
    try {
      this.validatePath(dirPath, 'dirPath');
      return this.resolveFilePath(process.cwd(), dirPath);
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'getDirPath',
        `Failed to resolve directory path: ${dirPath}`,
      );
      throw error;
    }
  }

  public static getFilePath(dirPath: string, fileName: string): string {
    try {
      this.validatePath(dirPath, 'directory');
      this.validatePath(fileName, 'fileName');

      const fullDirPath = this.getDirectoryPath(dirPath);
      return path.join(fullDirPath, fileName);
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'getFilePath',
        `Failed to construct file path for dirPath: '${dirPath}', fileName: '${fileName}'`,
      );
      throw error;
    }
  }

  /**
   * Checks if a file or directory is accessible
   * @param filePath - Path to check
   * @param mode - Access mode (optional, defaults to F_OK for existence check)
   * @param options - Operation options
   * @returns Promise with operation result
   */
  public static async checkAccess(
    filePath: string,
    mode: number = fs.constants.F_OK,
    options?: Partial<FileOperationOptions>,
  ): Promise<FileOperationResult> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    filePath = this.normalizePath(filePath);
    this.validatePath(filePath, 'filePath');

    try {
      await fs.promises.access(filePath, mode);
      return { success: true };
    } catch (error) {
      const modeDescription = this.getAccessModeDescription(mode);
      ErrorHandler.captureError(
        error,
        'checkAccess',
        `Access check failed for ${filePath} (${modeDescription})`,
      );

      if (opts.throwOnError) {
        throw error;
      }
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Helper method to get human-readable access mode description
   * @param mode - Access mode constant
   * @returns Description string
   */
  private static getAccessModeDescription(mode: number): string {
    const modes: string[] = [];

    if (mode & fs.constants.F_OK) modes.push('exists');
    if (mode & fs.constants.R_OK) modes.push('readable');
    if (mode & fs.constants.W_OK) modes.push('writable');
    if (mode & fs.constants.X_OK) modes.push('executable');

    return modes.length > 0 ? modes.join(', ') : 'unknown';
  }
}
