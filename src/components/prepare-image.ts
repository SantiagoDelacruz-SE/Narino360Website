// Process one image at a time in the browser before sending it. This uses the
// same maximum dimensions as the server and never changes the user's file.
export async function prepareImage(file: File): Promise<File> {
  let image: ImageBitmap;
  try {
    image = await createImageBitmap(file);
  } catch {
    throw new Error(
      'No se pudo leer "' + file.name + '". Usa JPG, PNG o WebP.',
    );
  }
  const canvas = document.createElement("canvas");
  try {
    if (image.width * image.height > 40000000)
      throw new Error(
        'La imagen "' + file.name + '" supera los 40 megapíxeles.',
      );
    const scale = Math.min(1, 4096 / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("El navegador no pudo preparar la imagen.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) =>
          result
            ? resolve(result)
            : reject(new Error("No se pudo preparar la imagen.")),
        "image/webp",
        0.92,
      );
    });
    // Some browsers fall back to PNG when an encoder isn't available.
    if (blob.size > 15 * 1024 * 1024)
      throw new Error(
        'Reduce el tamaño de "' + file.name + '" antes de cargarlo.',
      );
    return new File([blob], file.name, { type: blob.type });
  } finally {
    image.close();
    canvas.width = canvas.height = 1;
  }
}
