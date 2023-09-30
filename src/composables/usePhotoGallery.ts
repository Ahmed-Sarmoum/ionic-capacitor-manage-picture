import { ref, onMounted, watch } from "vue";
import { Capacitor } from "@capacitor/core";
import {
  Camera,
  CameraSource,
  CameraResultType,  
  Photo, 
} from "@capacitor/camera";
import { Preferences } from "@capacitor/preferences";

import { Filesystem, Directory } from "@capacitor/filesystem";
import { PhotoIntr } from "@/interfaces/photo.interface";
import { isPlatform } from "@ionic/vue";
import { actionSheetController } from '@ionic/vue'
import { trash, close } from 'ionicons/icons'

export function usePhotoGallery() {
  const PHOTO_STORAGE = "photos";
  const photos = ref<PhotoIntr[]>([]);

  const cachePhotos = async () => {
    await Preferences.set({
      key: PHOTO_STORAGE,
      value: JSON.stringify(photos.value),
    });
  };

  const deletePhoto = async (photo: PhotoIntr)  => {
    console.log('photo >>>', photo);
    
    photos.value = photos.value.filter(p => p.filePath !== photo.filePath)

    const fileName = photo.filePath.substring(photo.filePath.lastIndexOf('/') + 1)
    await Filesystem.deleteFile({
      path: fileName,
      directory: Directory.Data,
    })
  }

  const showActionSheet = async (photo: PhotoIntr) => {
    const actionSheet = await actionSheetController.create({
      header: 'Photos',
      buttons: [{
        text: 'Delete',
        role: 'desciption',
        icon: trash,
        handler: () => {
          deletePhoto(photo)
        }}, {
          text: 'Cancel', 
          icon: close,
          role: 'cancel',
          handler: () => {}
        }]
    })
    await actionSheet.present()
  } 

  watch(photos, cachePhotos);

  const loadSavded = async () => {
    const photoList = await Preferences.get({ key: PHOTO_STORAGE })
    const photosInStorage = photoList.value ? JSON.parse(photoList.value) : []

    if (!isPlatform('hybrid')) {
      for (const photo of photosInStorage) {
        const file = await Filesystem.readFile({
          path: photo.filePath,
          directory: Directory.Data,
        });
        photo.webViewPath = `data:image/jpeg;base64,${file.data}`
      }
    }

    photos.value = photosInStorage
  }

  const takePhoto = async () => {
    const cameraPhoto = await Camera.getPhoto({
      quality: 100,
      source: CameraSource.Camera,
      resultType: CameraResultType.Uri,
    });

    const fileName = new Date().getTime() + ".jpeg";
    const savedFileImage = await savePicture(cameraPhoto, fileName);
    photos.value = [savedFileImage, ...photos.value];
  };

  const convertBlobToBase64 = (blob: Blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;

      reader.onload = () => {
        resolve(reader.result);
      };

      reader.readAsDataURL(blob);
    });

    onMounted(loadSavded)

  const savePicture = async (
    photo: Photo,
    fileName: string
  ): Promise<PhotoIntr> => {
    let base64Data: string;

    if (isPlatform('hybrid'))  {
      const file = await Filesystem.readFile({
        path: photo.path!
      })
      base64Data = file.data as string
    } else {
      const response = await fetch(photo.webPath!);
      const blob = await response.blob();
      base64Data = (await convertBlobToBase64(blob)) as string;
    }


    const saveFile = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Data,
    });

    if (isPlatform('hybrid')) {
      return {
        filePath: saveFile.uri,
        webViewPath: Capacitor.convertFileSrc(saveFile.uri)
      }
    } else {
      return {
        filePath: fileName,
        webViewPath: photo.webPath,
      };
    }

  };

  return {
    photos,
    takePhoto,
    deletePhoto,
    showActionSheet
  };
}
