import { Injectable } from "@angular/core";
import {
  Plugins,
  CameraResultType,
  Capacitor,
  FilesystemDirectory,
  CameraPhoto,
  CameraSource,
} from "@capacitor/core";
import { Photo } from "./api/photo";
import { Platform } from "@ionic/angular";
const { Camera, Filesystem } = Plugins;

/**
 * Provides native integration abstraction to invoke capture
 * of images from mobile device camera.
 */
@Injectable({
  providedIn: "root",
})
export class PhotoService {
  public photos: Photo[] = [];
  private platform: Platform;

  constructor(platform: Platform) {
    this.platform = platform;
  }

  /**
   * Invokes native camera prompt for user to capture image and returns
   * filepath of image location.
   */
  public async addNewToGallery() {
    // Capture image from mobile device camera
    const capturedPhoto = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      quality: 100,
      height: 600,
      width: 480,
      saveToGallery: true,
    });
    // Save the image and add it to photo collection
    const savedImageFile = await this.savePicture(capturedPhoto);
    this.photos.unshift({
      filepath: null,
      webviewPath: capturedPhoto.webPath,
    });
    return savedImageFile;
  }

  /**
   * Flush all images from filesystem that are currently within memory.
   */
  public async flushPhotos() {
    this.photos.forEach(async (photo) => {
      if (photo.filepath) {
        await Filesystem.deleteFile({
          path: photo.filepath,
          directory: FilesystemDirectory.Data,
        });
      }
    });
    this.photos = [];
  }

  /**
   * Saves CameraPhoto objects into mobile device filesystem.
   * @param  {CameraPhoto} cameraPhoto
   */
  private async savePicture(cameraPhoto: CameraPhoto) {
    // Convert image to base64 format, required by Filesystem API to save
    const base64Data = await this.readAsBase64(cameraPhoto);
    // Write the image file to the data directory using current time as
    // crude identifier.
    const fileName = new Date().getTime() + ".jpeg";
    const savedFile = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: FilesystemDirectory.Data,
    });
    // Display the new image by rewriting the 'file://' path to HTTP
    // Details: https://ionicframework.com/docs/building/webview#file-protocol
    if (this.platform.is("hybrid")) {
      return {
        filepath: savedFile.uri,
        webviewPath: Capacitor.convertFileSrc(savedFile.uri),
        base64: base64Data,
      };
    }
    // Use webPath to display the new image instead of base64 since it is
    // already loaded into memory
    else {
      return {
        filepath: fileName,
        webviewPath: cameraPhoto.webPath,
        base64: base64Data,
      };
    }
  }

  /**
   * Returns raw base64 data of cameria photo.
   * @param  {CameraPhoto} cameraPhoto
   */
  private async readAsBase64(cameraPhoto: CameraPhoto) {
    // "hybrid" will detect if current platform is Cordova or Capacitor
    if (this.platform.is("hybrid")) {
      // Read the file and convert into base64 format
      const file = await Filesystem.readFile({
        path: cameraPhoto.path,
      });
      return file.data;
    } else {
      // Fetch the photo, read as a blob, then convert to base64 format
      const response = await fetch(cameraPhoto.webPath);
      const blob = await response.blob();
      return (await this.convertBlobToBase64(blob)) as string;
    }
  }

  /**
   * Helper function to convert image blob to base64.
   * @param  {Blob} blob
   */
  private convertBlobToBase64 = (blob: Blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        resolve(reader.result);
      };
      reader.readAsDataURL(blob);
    });
}

/* Normally separate file, included for comprehension. */
export interface Photo {
  filepath: string;
  webviewPath: string;
  base64?: string;
}