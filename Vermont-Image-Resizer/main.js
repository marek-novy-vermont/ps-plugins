const app = window.require('photoshop').app;
const fs = window.require('uxp').storage.localFileSystem;
const { batchPlay } = window.require('photoshop').action;
const { SolidColor } = window.require('photoshop').constants;

// Default settings
let targetWidth = 1600;
let targetHeight = 2400;
let defaultBgColor = "#FFFFFF";

// Global state variables
let shouldAbortProcessing = false;
let selectedInputFolder = null;
let selectedOutputFolder = null;
let fillMethod = "normal";
let qualityValue = 12;

// DOM Elements
document.addEventListener('DOMContentLoaded', () => {
    // Get DOM elements
    const widthInput = document.getElementById('width');
    const heightInput = document.getElementById('height');
    const fillMethodDropdown = document.getElementById('fillMethodDropdown');
    const bgColorPanel = document.getElementById('bgColorPanel');
    const methodDescription = document.getElementById('methodDescription');
    const hexColorInput = document.getElementById('hexColor');
    const rInput = document.getElementById('rInput');
    const gInput = document.getElementById('gInput');
    const bInput = document.getElementById('bInput');
    const colorPreview = document.getElementById('colorPreview');
    const qualitySlider = document.getElementById('qualitySlider');
    const qualityValueElem = document.getElementById('qualityValue');
    const inputFolderElem = document.getElementById('inputFolder');
    const outputFolderElem = document.getElementById('outputFolder');
    const selectInputButton = document.getElementById('selectInputButton');
    const selectOutputButton = document.getElementById('selectOutputButton');
    const useInputFolder = document.getElementById('useInputFolder');
    const useCustomFolder = document.getElementById('useCustomFolder');
    const progressBar = document.getElementById('progressBar');
    const statusText = document.getElementById('statusText');
    const runButton = document.getElementById('runButton');
    const abortButton = document.getElementById('abortButton');

    // Initialize elements with default values
    widthInput.value = targetWidth;
    heightInput.value = targetHeight;
    hexColorInput.value = defaultBgColor;
    colorPreview.style.backgroundColor = defaultBgColor;

    // Event handlers
    widthInput.addEventListener('change', () => {
        targetWidth = parseInt(widthInput.value);
    });

    heightInput.addEventListener('change', () => {
        targetHeight = parseInt(heightInput.value);
    });

    fillMethodDropdown.addEventListener('change', () => {
        const selectedFillMethod = fillMethodDropdown.selectedItem.value;
        fillMethod = selectedFillMethod;
        
        // Show/hide background color panel based on fill method
        bgColorPanel.style.display = (selectedFillMethod === 'normal') ? 'block' : 'none';
        
        // Update method description
        switch(selectedFillMethod) {
            case 'normal':
                methodDescription.textContent = 'Normálne Vyplnenie: Zachová celý obrázok a pridá farbu pozadia';
                break;
            case 'crop':
                methodDescription.textContent = 'Orezanie: Prispôsobí výške a oreže prebytočnú šírku zo strán';
                break;
            case 'contentAware':
                methodDescription.textContent = 'Generatívne Rozšírenie: Používa AI na vyplnenie rozšírených oblastí';
                break;
        }
    });

    // Update color preview and RGB values when HEX changes
    hexColorInput.addEventListener('change', () => {
        const hex = hexColorInput.value;
        if (isValidHex(hex)) {
            colorPreview.style.backgroundColor = hex;
            const rgb = hexToRgb(hex);
            rInput.value = rgb.r;
            gInput.value = rgb.g;
            bInput.value = rgb.b;
        }
    });

    // Update color preview and HEX when RGB changes
    function updateFromRGB() {
        const r = parseInt(rInput.value);
        const g = parseInt(gInput.value);
        const b = parseInt(bInput.value);
        
        if (isValidRGB(r) && isValidRGB(g) && isValidRGB(b)) {
            const hex = rgbToHex(r, g, b);
            hexColorInput.value = hex;
            colorPreview.style.backgroundColor = hex;
        }
    }

    rInput.addEventListener('change', updateFromRGB);
    gInput.addEventListener('change', updateFromRGB);
    bInput.addEventListener('change', updateFromRGB);

    // Quality slider
    qualitySlider.addEventListener('change', () => {
        qualityValue = Math.round(qualitySlider.value);
        qualityValueElem.textContent = qualityValue;
    });

    // Folder selection
    selectInputButton.addEventListener('click', async () => {
        try {
            selectedInputFolder = await fs.getFolder();
            inputFolderElem.value = selectedInputFolder.nativePath;
            
            if (useInputFolder.checked) {
                const timestamp = getTimestamp();
                outputFolderElem.value = `${selectedInputFolder.nativePath}/spracovane_${timestamp}`;
            }
            
            runButton.disabled = !selectedInputFolder || (useCustomFolder.checked && !selectedOutputFolder);
        } catch (e) {
            console.error("Error selecting input folder:", e);
        }
    });

    selectOutputButton.addEventListener('click', async () => {
        try {
            selectedOutputFolder = await fs.getFolder();
            outputFolderElem.value = selectedOutputFolder.nativePath;
            runButton.disabled = !selectedInputFolder || (useCustomFolder.checked && !selectedOutputFolder);
        } catch (e) {
            console.error("Error selecting output folder:", e);
        }
    });

    useInputFolder.addEventListener('click', () => {
        selectOutputButton.disabled = true;
        if (selectedInputFolder) {
            const timestamp = getTimestamp();
            outputFolderElem.value = `${selectedInputFolder.nativePath}/spracovane_${timestamp}`;
        }
        runButton.disabled = !selectedInputFolder;
    });

    useCustomFolder.addEventListener('click', () => {
        selectOutputButton.disabled = false;
        outputFolderElem.value = selectedOutputFolder ? selectedOutputFolder.nativePath : '';
        runButton.disabled = !selectedInputFolder || !selectedOutputFolder;
    });

    // Run and abort buttons
    runButton.addEventListener('click', async () => {
        // Validate settings
        if (fillMethod === 'normal' && !isValidHex(hexColorInput.value)) {
            await showAlert("Prosím zadajte platnú hex farbu (napr. #FFFFFF) pre pozadie");
            return;
        }

        let outputFolder;
        if (useInputFolder.checked) {
            const timestamp = getTimestamp();
            const outputPath = `${selectedInputFolder.nativePath}/spracovane_${timestamp}`;
            try {
                outputFolder = await fs.createFolder(outputPath);
                outputFolderElem.value = outputPath;
            } catch (e) {
                await showAlert(`Nepodarilo sa vytvoriť výstupný priečinok: ${e.message}`);
                return;
            }
        } else {
            outputFolder = selectedOutputFolder;
        }

        // Reset abort flag and update UI
        shouldAbortProcessing = false;
        abortButton.disabled = false;
        runButton.disabled = true;
        
        // Read dimensions
        targetWidth = parseInt(widthInput.value);
        targetHeight = parseInt(heightInput.value);
        
        // Process images
        await processFolder(selectedInputFolder, outputFolder, qualityValue, hexColorInput.value);
        
        // Update UI after completion
        abortButton.disabled = true;
        runButton.disabled = false;
    });

    abortButton.addEventListener('click', () => {
        shouldAbortProcessing = true;
        statusText.textContent = "Prerušenie spracovania...";
        abortButton.disabled = true;
    });
});

// =============================================
// HELPER FUNCTIONS
// =============================================

// Helper function to convert hex to RGB
function hexToRgb(hex) {
    hex = hex.replace('#', '');
    return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16)
    };
}

// Helper function to convert RGB to Hex
function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

// Helper function to validate hex color
function isValidHex(hex) {
    return /^#[0-9A-F]{6}$/i.test(hex);
}

// Helper function to validate RGB values
function isValidRGB(value) {
    return !isNaN(value) && value >= 0 && value <= 255;
}

// Helper function to generate timestamp
function getTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = ("0" + (now.getMonth() + 1)).slice(-2);
    const day = ("0" + now.getDate()).slice(-2);
    const hours = ("0" + now.getHours()).slice(-2);
    const minutes = ("0" + now.getMinutes()).slice(-2);
    const seconds = ("0" + now.getSeconds()).slice(-2);
    
    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

// Helper function to show alerts
async function showAlert(message) {
    const app = window.require('photoshop').app;
    await app.showAlert(message);
}

// =============================================
// MAIN PROCESSING FUNCTIONS
// =============================================

/**
 * Process a folder of images
 */
async function processFolder(inputFolder, outputFolder, quality, bgColor) {
    const statusText = document.getElementById('statusText');
    const progressBar = document.getElementById('progressBar');
    
    try {
        // Get all image files in the folder
        const entries = await inputFolder.getEntries();
        const imageFiles = entries.filter(entry => {
            const name = entry.name.toLowerCase();
            return entry.isFile && 
                  (name.endsWith('.jpg') || 
                   name.endsWith('.jpeg') || 
                   name.endsWith('.png') || 
                   name.endsWith('.tif') || 
                   name.endsWith('.psd'));
        });
        
        if (imageFiles.length === 0) {
            await showAlert("V priečinku sa nenašli žiadne platné obrázkové súbory.");
            statusText.textContent = "Žiadne platné súbory na spracovanie.";
            progressBar.value = 0;
            return;
        }
        
        let processed = 0;
        let errors = 0;
        
        for (let i = 0; i < imageFiles.length; i++) {
            if (shouldAbortProcessing) {
                statusText.textContent = `Proces prerušený. Spracované: ${processed} súborov, Chyby: ${errors}`;
                return;
            }
            
            const file = imageFiles[i];
            progressBar.value = (i / imageFiles.length) * 100;
            statusText.textContent = `Spracovávam: ${file.name}`;
            
            try {
                // Open the file
                const result = await app.open(file);
                const doc = app.activeDocument;
                
                // Process based on fill method
                if (fillMethod === "normal") {
                    await resizeAndCenterImage(doc, bgColor);
                } else if (fillMethod === "contentAware") {
                    await resizeWithGenerativeExpand(doc);
                } else if (fillMethod === "crop") {
                    await cropImage(doc);
                }
                
                // Save the processed file
                const saveFile = await outputFolder.createFile(file.name, { overwrite: true });
                
                // Configure save options
                const saveOptions = {
                    _obj: "save",
                    as: {
                        _obj: "JPEG",
                        quality: quality,
                        embedColorProfile: true,
                        formatOptions: {
                            _obj: "JPEGFormat",
                            qualitySetting: quality,
                            scans: 3,
                            matte: {
                                _enum: "matteType",
                                _value: "none"
                            }
                        }
                    },
                    in: {
                        _path: saveFile.nativePath,
                        _kind: "local"
                    },
                    documentID: doc.id,
                    copy: true,
                    lowerCase: true
                };
                
                await batchPlay([saveOptions], {});
                
                // Close the document
                await doc.close();
                
                processed++;
            } catch (e) {
                errors++;
                console.error(`Error processing file ${file.name}: ${e.message}`);
                await showAlert(`Chyba pri spracovaní súboru ${file.name}: ${e.message}`);
            }
        }
        
        progressBar.value = 100;
        statusText.textContent = `Dokončené! Spracované: ${processed} súborov, Chyby: ${errors}`;
        
    } catch (e) {
        console.error(`Process folder error: ${e.message}`);
        await showAlert(`Chyba: ${e.message}`);
    }
}

/**
 * OPTION 1: Normal Fill
 * Resize the image proportionally to fit within target dimensions
 * and add background color to fill the canvas
 */
async function resizeAndCenterImage(doc, bgColor) {
    try {
        // Calculate proportional dimensions to fit within target
        const ratio = Math.min(targetWidth / doc.width, targetHeight / doc.height);
        const newWidth = Math.round(doc.width * ratio);
        const newHeight = Math.round(doc.height * ratio);
        
        // Resize the image
        await doc.resizeImage(newWidth, newHeight, null, "bicubic");
        
        // Set background color
        const rgb = hexToRgb(bgColor);
        const solidColor = new SolidColor();
        solidColor.rgb.red = rgb.r;
        solidColor.rgb.green = rgb.g;
        solidColor.rgb.blue = rgb.b;
        
        // Create new canvas with background color
        await doc.resizeCanvas(targetWidth, targetHeight, "center");
        
        // Create a new layer at the bottom for the background color
        const newLayer = await doc.createLayer();
        
        // Move the new layer to the bottom
        const layers = await doc.layers;
        await layers[layers.length-1].move(layers[0], "placebefore");
        
        // Fill the background layer with the color
        await doc.selection.selectAll();
        await doc.selection.fill(solidColor);
        await doc.selection.deselect();
        
    } catch (e) {
        console.error(`Error in resizeAndCenterImage: ${e.message}`);
        throw e;
    }
}

/**
 * OPTION 2: Crop
 * Resize the image to match the target height and crop excess width
 */
async function cropImage(doc) {
    try {
        // First, scale the image to match the target height exactly
        const heightRatio = targetHeight / doc.height;
        const scaledWidth = Math.round(doc.width * heightRatio);
        
        // Resize image to match target height
        await doc.resizeImage(scaledWidth, targetHeight, null, "bicubic");
        
        // If the width is larger than target width, crop the sides
        if (scaledWidth > targetWidth) {
            // Calculate how much to trim from each side
            const excessWidth = scaledWidth - targetWidth;
            const trimFromEachSide = Math.round(excessWidth / 2);
            
            // Crop to target width, centered
            await doc.crop([trimFromEachSide, 0, trimFromEachSide + targetWidth, targetHeight]);
        } else if (scaledWidth < targetWidth) {
            // In rare cases where the image is too narrow after scaling to height,
            // scale to width instead to ensure we fill the frame
            const widthRatio = targetWidth / scaledWidth;
            const newHeight = Math.round(targetHeight * widthRatio);
            await doc.resizeImage(targetWidth, newHeight, null, "bicubic");
            
            // Crop excess height from top and bottom
            const excessHeight = newHeight - targetHeight;
            const trimFromTopBottom = Math.round(excessHeight / 2);
            await doc.crop([0, trimFromTopBottom, targetWidth, trimFromTopBottom + targetHeight]);
        }
    } catch (e) {
        console.error(`Error in cropImage: ${e.message}`);
        throw e;
    }
}

/**
 * OPTION 3: Generative Expand
 * Uses Photoshop's Generative Expand to intelligently fill expanded areas
 */
async function resizeWithGenerativeExpand(doc) {
    try {
        // Calculate proportional dimensions to fit within target
        const ratio = Math.min(targetWidth / doc.width, targetHeight / doc.height);
        const newWidth = Math.round(doc.width * ratio);
        const newHeight = Math.round(doc.height * ratio);
        
        // Resize the image proportionally
        await doc.resizeImage(newWidth, newHeight, null, "bicubic");
        
        // Resize canvas to target dimensions
        await doc.resizeCanvas(targetWidth, targetHeight, "center");
        
        // Use batchPlay to access the Generative Fill API
        try {
            // Try to use Generative Fill on the canvas
            const fillOptions = {
                _obj: "generativeFillCanvas",
                _options: {
                    dialogOptions: "dontDisplay"
                }
            };
            
            await batchPlay([fillOptions], {});
        } catch (genError) {
            console.warn("Generative Fill failed, attempting alternative approach:", genError.message);
            
            try {
                // Create a selection of the transparent areas by selecting all then inverting
                await doc.selection.selectAll();
                await doc.selection.invert();
                
                // Try Content-Aware Fill as fallback
                const contentAwareFill = {
                    _obj: "fill",
                    using: {
                        _enum: "fillContents",
                        _value: "contentAware"
                    },
                    _options: {
                        dialogOptions: "dontDisplay"
                    }
                };
                
                await batchPlay([contentAwareFill], {});
                await doc.selection.deselect();
            } catch (caError) {
                console.warn("Content-Aware Fill also failed:", caError.message);
                await showAlert("Upozornenie: Nepodarilo sa použiť Generatívne Rozšírenie. Vaša verzia Photoshopu možno nepodporuje túto funkciu.");
            }
        }
    } catch (e) {
        console.error(`Error in resizeWithGenerativeExpand: ${e.message}`);
        throw e;
    }
} 