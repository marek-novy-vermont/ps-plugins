//@target photoshop

// Nastavenie predvolených rozmerov Vermont Gant 
var targetWidth = 1080;
var targetHeight = 1080;
var defaultBgColor = "#FFFFFF";
var watermarkFile = null;
var watermarkOpacity = 100; // percentage
var watermarkBlendMode = "normal"; // Default blend mode
var watermarkSizing = "original"; // Default sizing option: "original", "contain", or "cover"

// Pridanie globálnej premennej pre prerušenie spracovania
var shouldAbortProcessing = false;

// =============================================
// POMOCNÉ FUNKCIE
// =============================================

// Pomocná funkcia na konverziu hex na RGB
function hexToRgb(hex) {
    hex = hex.replace('#', '');
    return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16)
    };
}

// Pomocná funkcia na konverziu RGB na Hex
function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

// Pomocná funkcia na validáciu hex farby
function isValidHex(hex) {
    return /^#[0-9A-F]{6}$/i.test(hex);
}

// Pomocná funkcia na validáciu RGB hodnôt
function isValidRGB(value) {
    return !isNaN(value) && value >= 0 && value <= 255;
}

// Pomocná funkcia na generovanie časovej pečiatky
function getTimestamp() {
    var now = new Date();
    var year = now.getFullYear();
    var month = ("0" + (now.getMonth() + 1)).slice(-2);
    var day = ("0" + now.getDate()).slice(-2);
    var hours = ("0" + now.getHours()).slice(-2);
    var minutes = ("0" + now.getMinutes()).slice(-2);
    var seconds = ("0" + now.getSeconds()).slice(-2);
    
    return year + "-" + month + "-" + day + "_" + hours + "-" + minutes + "-" + seconds;
}

// =============================================
// HLAVNÉ FUNKCIE SPRACOVANIA
// =============================================

/**
 * MOŽNOSŤ 1: Normálne Vyplnenie
 * Zmení veľkosť obrázka proporcionálne, aby sa zmestil do cieľových rozmerov
 * a pridá farbu pozadia na vyplnenie plátna
 */
function resizeAndCenterImage(doc, bgColor) {
    try {
        var docCopy = doc.duplicate();
        
        // Convert background to layer if it's a background
        if (docCopy.layers[docCopy.layers.length-1].isBackgroundLayer) {
            docCopy.layers[docCopy.layers.length-1].isBackgroundLayer = false;
        }
        
        // Calculate proportional dimensions to fit within target
        var ratio = Math.min(targetWidth / docCopy.width, targetHeight / docCopy.height);
        var newWidth = Math.round(docCopy.width * ratio);
        var newHeight = Math.round(docCopy.height * ratio);
        
        // Resize the image
        docCopy.resizeImage(newWidth, newHeight, null, ResampleMethod.BICUBIC);
        
        // Set background color
        var rgb = hexToRgb(bgColor);
        var solidColor = new SolidColor();
        solidColor.rgb.red = rgb.r;
        solidColor.rgb.green = rgb.g;
        solidColor.rgb.blue = rgb.b;
        app.backgroundColor = solidColor;
        
        // Create new canvas with background color
        docCopy.resizeCanvas(targetWidth, targetHeight, AnchorPosition.MIDDLECENTER);
        
        // Create a new layer at the bottom for the background color
        docCopy.artLayers.add();
        
        // Move the new layer to the bottom
        var bgLayer = docCopy.artLayers[docCopy.artLayers.length-1];
        bgLayer.move(docCopy.artLayers[0], ElementPlacement.PLACEBEFORE);
        
        // Fill the background layer with the color
        docCopy.selection.selectAll();
        docCopy.selection.fill(solidColor);
        docCopy.selection.deselect();
        
        return docCopy;
    } catch(e) {
        alert("Chyba pri normálnom vyplnení: " + e);
        if (docCopy) {
            docCopy.close(SaveOptions.DONOTSAVECHANGES);
        }
        return null;
    }
}

/**
 * MOŽNOSŤ 2: Orezanie
 * Prispôsobí obrázok cieľovej šírke a oreže prebytočnú výšku zhora a zdola
 * Nepridáva sa žiadna farba pozadia - obrázok vypĺňa celé plátno
 */
function cropImage(doc) {
    try {
        var docCopy = doc.duplicate();
        
        // First, scale the image to match the target width exactly
        var widthRatio = targetWidth / docCopy.width;
        var scaledHeight = Math.round(docCopy.height * widthRatio);
        
        // Resize image to match target width
        docCopy.resizeImage(targetWidth, scaledHeight, null, ResampleMethod.BICUBIC);
        
        // If the height is larger than target height, crop the top and bottom
        if (scaledHeight > targetHeight) {
            // Calculate how much to trim from top and bottom
            var excessHeight = scaledHeight - targetHeight;
            var trimFromTopBottom = Math.round(excessHeight / 2);
            
            // Crop to target height, centered
            docCopy.crop([0, trimFromTopBottom, targetWidth, trimFromTopBottom + targetHeight]);
        } else if (scaledHeight < targetHeight) {
            // In rare cases where the image is too short after scaling to width,
            // scale to height instead to ensure we fill the frame
            var heightRatio = targetHeight / scaledHeight;
            var newWidth = Math.round(targetWidth * heightRatio);
            docCopy.resizeImage(newWidth, targetHeight, null, ResampleMethod.BICUBIC);
            
            // Crop excess width from sides
            var excessWidth = newWidth - targetWidth;
            var trimFromEachSide = Math.round(excessWidth / 2);
            docCopy.crop([trimFromEachSide, 0, trimFromEachSide + targetWidth, targetHeight]);
        }
        
        return docCopy;
    } catch(e) {
        alert("Chyba pri orezávaní: " + e);
        if (docCopy) {
            docCopy.close(SaveOptions.DONOTSAVECHANGES);
        }
        return null;
    }
}

/**
 * MOŽNOSŤ 3: Generatívne Rozšírenie
 * Používa funkciu Photoshopu Generative Expand na inteligentné vyplnenie rozšírených oblastí
 * Nepotrebuje farbu pozadia - automaticky vzorkuje z obrázka
 */
function resizeWithGenerativeExpand(doc) {
    try {
        var docCopy = doc.duplicate();
        
        // First, we need to make sure we're working with a document that has layers
        if (docCopy.layers[docCopy.layers.length-1].isBackgroundLayer) {
            docCopy.layers[docCopy.layers.length-1].isBackgroundLayer = false;
        }
        
        // Calculate proportional dimensions to fit within target
        var ratio = Math.min(targetWidth / docCopy.width, targetHeight / docCopy.height);
        var newWidth = Math.round(docCopy.width * ratio);
        var newHeight = Math.round(docCopy.height * ratio);
        
        // Resize the image proportionally
        docCopy.resizeImage(newWidth, newHeight, null, ResampleMethod.BICUBIC);
        
        // Create a history state before we start
        var startState = docCopy.activeHistoryState;
        
        // Try multiple approaches to ensure compatibility with different Photoshop versions
        var success = false;
        
        // Approach 1: Use the Crop tool with Generative Expand
        try {
            // Select the Crop tool
            var idslct = charIDToTypeID("slct");
            var desc = new ActionDescriptor();
            var idnull = charIDToTypeID("null");
            var ref = new ActionReference();
            var idCrpT = charIDToTypeID("CrpT");
            ref.putClass(idCrpT);
            desc.putReference(idnull, ref);
            executeAction(idslct, desc, DialogModes.NO);
            
            // Set the crop rectangle
            var idCrop = charIDToTypeID("Crop");
            var cropDesc = new ActionDescriptor();
            var idT = charIDToTypeID("T   ");
            var idTop = charIDToTypeID("Top ");
            cropDesc.putUnitDouble(idTop, idT, 0);
            var idLeft = charIDToTypeID("Left");
            cropDesc.putUnitDouble(idLeft, idT, 0);
            var idBtom = charIDToTypeID("Btom");
            cropDesc.putUnitDouble(idBtom, idT, targetHeight);
            var idRght = charIDToTypeID("Rght");
            cropDesc.putUnitDouble(idRght, idT, targetWidth);
            
            // Center the image in the crop
            var idHrzn = charIDToTypeID("Hrzn");
            var idHrzL = charIDToTypeID("HrzL");
            var idCntr = charIDToTypeID("Cntr");
            cropDesc.putEnumerated(idHrzn, idHrzL, idCntr);
            var idVrtc = charIDToTypeID("Vrtc");
            var idVrtL = charIDToTypeID("VrtL");
            cropDesc.putEnumerated(idVrtc, idVrtL, idCntr);
            
            // Apply the crop with Generative Expand
            var idDlt = charIDToTypeID("Dlt ");
            cropDesc.putBoolean(idDlt, false); // Don't delete cropped pixels
            
            // Enable Generative Expand
            var idgenerativeExpandEnabled = stringIDToTypeID("generativeExpandEnabled");
            cropDesc.putBoolean(idgenerativeExpandEnabled, true);
            
            // Execute the crop with Generative Expand
            executeAction(idCrop, cropDesc, DialogModes.NO);
            
            // Now we need to apply the Generative Expand
            var idgenerativeFillCanvas = stringIDToTypeID("generativeFillCanvas");
            var genDesc = new ActionDescriptor();
            executeAction(idgenerativeFillCanvas, genDesc, DialogModes.NO);
            
            success = true;
        } catch(cropError) {
            // If first approach fails, revert and try the second approach
            docCopy.activeHistoryState = startState;
        }
        
        // Approach 2: Use Canvas Size with Generative Expand
        if (!success) {
            try {
                // First resize the canvas to target dimensions
                docCopy.resizeCanvas(targetWidth, targetHeight, AnchorPosition.MIDDLECENTER);
                
                // Try to use the newer Generative Fill API
                var idgenerativeFillCanvas = stringIDToTypeID("generativeFillCanvas");
                var genDesc = new ActionDescriptor();
                executeAction(idgenerativeFillCanvas, genDesc, DialogModes.NO);
                
                success = true;
            } catch(genError1) {
                // If second approach fails, revert and try the third approach
                docCopy.activeHistoryState = startState;
            }
        }
        
        // Approach 3: Use Content-Aware Fill on selection
        if (!success) {
            try {
                // Resize canvas
                docCopy.resizeCanvas(targetWidth, targetHeight, AnchorPosition.MIDDLECENTER);
                
                // Create a selection of the transparent areas
                // Select all
                docCopy.selection.selectAll();
                
                // Invert selection to get transparent areas
                docCopy.selection.invert();
                
                // Try to use Generative Fill on the selection
                try {
                    var idFl = charIDToTypeID("Fl  ");
                    var fillDesc = new ActionDescriptor();
                    var idUsng = charIDToTypeID("Usng");
                    var idFlCn = charIDToTypeID("FlCn");
                    var idgenerativeFill = stringIDToTypeID("generativeFill");
                    fillDesc.putEnumerated(idUsng, idFlCn, idgenerativeFill);
                    executeAction(idFl, fillDesc, DialogModes.NO);
                    
                    success = true;
                } catch(genError2) {
                    // If Generative Fill fails, try Content-Aware Fill
                    try {
                        var idFl = charIDToTypeID("Fl  ");
                        var fillDesc = new ActionDescriptor();
                        var idUsng = charIDToTypeID("Usng");
                        var idFlCn = charIDToTypeID("FlCn");
                        var idcontentAware = stringIDToTypeID("contentAware");
                        fillDesc.putEnumerated(idUsng, idFlCn, idcontentAware);
                        executeAction(idFl, fillDesc, DialogModes.NO);
                        
                        success = true;
                    } catch(caError) {
                        // If all fill methods fail, just leave the transparent areas
                    }
                }
                
                // Deselect
                docCopy.selection.deselect();
            } catch(selectionError) {
                // If selection approach fails, just leave the canvas as is
            }
        }
        
        // If all approaches failed, just resize the canvas
        if (!success) {
            docCopy.activeHistoryState = startState;
            docCopy.resizeCanvas(targetWidth, targetHeight, AnchorPosition.MIDDLECENTER);
            alert("Upozornenie: Nepodarilo sa použiť Generatívne Rozšírenie. Vaša verzia Photoshopu možno nepodporuje túto funkciu.\nSkúste aktualizovať Photoshop na najnovšiu verziu s podporou Generative Expand.");
        }
        
        return docCopy;
    } catch(e) {
        alert("Chyba pri generatívnom rozšírení: " + e);
        if (docCopy) {
            docCopy.close(SaveOptions.DONOTSAVECHANGES);
        }
        return null;
    }
}

/**
 * MOŽNOSŤ 4: Pridanie vodoznaku
 * Pridá vodoznak na vrch obrázka s možnosťou umiestnenia bez škálovania
 */
function addWatermark(doc, watermarkFile, opacity, blendMode, sizing, fillMethod) {
    try {
        // Open the watermark file
        var watermarkDoc = open(watermarkFile);
        
        // Select all and copy
        watermarkDoc.selection.selectAll();
        watermarkDoc.selection.copy();
        watermarkDoc.close(SaveOptions.DONOTSAVECHANGES);
        
        // Paste into the target document
        doc.paste();
        
        // Get the watermark layer
        var watermarkLayer = doc.activeLayer;
        
        // Move the watermark layer to the top
        watermarkLayer.move(doc.layers[0], ElementPlacement.PLACEBEFORE);
        
        // Set the opacity of the watermark layer
        watermarkLayer.opacity = opacity;

        // Set the blend mode
        switch(blendMode) {
            case "normal": watermarkLayer.blendMode = BlendMode.NORMAL; break;
            case "dissolve": watermarkLayer.blendMode = BlendMode.DISSOLVE; break;
            case "multiply": watermarkLayer.blendMode = BlendMode.MULTIPLY; break;
            case "overlay": watermarkLayer.blendMode = BlendMode.OVERLAY; break;
            case "softLight": watermarkLayer.blendMode = BlendMode.SOFTLIGHT; break;
            case "hardLight": watermarkLayer.blendMode = BlendMode.HARDLIGHT; break;
            case "difference": watermarkLayer.blendMode = BlendMode.DIFFERENCE; break;
            case "exclusion": watermarkLayer.blendMode = BlendMode.EXCLUSION; break;
            case "screen": watermarkLayer.blendMode = BlendMode.SCREEN; break;
            case "linearLight": watermarkLayer.blendMode = BlendMode.LINEARLIGHT; break;
            case "pinLight": watermarkLayer.blendMode = BlendMode.PINLIGHT; break;
            case "darken": watermarkLayer.blendMode = BlendMode.DARKEN; break;
            case "lighten": watermarkLayer.blendMode = BlendMode.LIGHTEN; break;
        }
        
        // Get the actual dimensions of the watermark layer
        var bounds = watermarkLayer.bounds;
        var watermarkWidth = bounds[2] - bounds[0];
        var watermarkHeight = bounds[3] - bounds[1];
        
        // Resize watermark based on sizing option
        if (sizing === "contain" || sizing === "cover") {
            // Determine the target dimensions for sizing
            var targetAreaWidth, targetAreaHeight;
            
            if (fillMethod === "normal") {
                // For normal fill method, get the content dimensions
                // We know content is one layer above the background filled layer
                var contentLayer = doc.layers[1]; // Image content is the second layer (index 1) in normal fill
                var contentBounds = contentLayer.bounds;
                targetAreaWidth = contentBounds[2] - contentBounds[0];
                targetAreaHeight = contentBounds[3] - contentBounds[1];
            } else {
                // For other methods, use the full document dimensions
                targetAreaWidth = doc.width;
                targetAreaHeight = doc.height;
            }
            
            // Calculate ratios based on the appropriate target dimensions
            var widthRatio = targetAreaWidth / watermarkWidth;
            var heightRatio = targetAreaHeight / watermarkHeight;
            
            var scale;
            if (sizing === "contain") {
                // Use the smaller ratio to ensure the watermark fits entirely within the target area
                scale = Math.min(widthRatio, heightRatio);
            } else { // "cover"
                // Use the larger ratio to ensure the watermark covers the entire target area
                scale = Math.max(widthRatio, heightRatio);
            }
            
            // Resize the watermark
            watermarkLayer.resize(scale * 100, scale * 100, AnchorPosition.MIDDLECENTER);
            
            // Update bounds after resizing
            bounds = watermarkLayer.bounds;
            watermarkWidth = bounds[2] - bounds[0];
            watermarkHeight = bounds[3] - bounds[1];
        }
        
        // Center the watermark based on fill method
        var docCenterX, docCenterY;
        
        if (fillMethod === "normal") {
            // For normal fill, center over the content (second layer), not the entire canvas
            var contentLayer = doc.layers[1]; // Content layer
            var contentBounds = contentLayer.bounds;
            docCenterX = (contentBounds[0] + contentBounds[2]) / 2;
            docCenterY = (contentBounds[1] + contentBounds[3]) / 2;
        } else {
            // For other methods, center on the entire canvas
            docCenterX = doc.width / 2;
            docCenterY = doc.height / 2;
        }
        
        // Calculate the center of the watermark layer
        var watermarkCenterX = (bounds[0] + bounds[2]) / 2;
        var watermarkCenterY = (bounds[1] + bounds[3]) / 2;
        
        // Calculate the translation needed to center the watermark
        var deltaX = docCenterX - watermarkCenterX;
        var deltaY = docCenterY - watermarkCenterY;
        
        // Apply the translation
        watermarkLayer.translate(deltaX, deltaY);
        
        return doc;
    } catch(e) {
        alert("Chyba pri pridávaní vodoznaku: " + e);
        return doc;
    }
}

// =============================================
// FUNKCIA DÁVKOVÉHO SPRACOVANIA
// =============================================

// Funkcia na spracovanie každého obrázka vo vybranom priečinku
function processFolder(inputFolder, outputFolder, quality, progressBar, statusText, bgColor, fillMethod, watermarkSettings) {
    try {
        // Validate background color for methods that use it
        if (fillMethod === "normal") {
            if (!isValidHex(bgColor)) {
                alert("Neplatný formát farby pozadia. Používam predvolenú bielu (#FFFFFF).");
                bgColor = "#FFFFFF";
            }
            
            // Set the background color for the app
            var rgb = hexToRgb(bgColor);
            var solidColor = new SolidColor();
            solidColor.rgb.red = rgb.r;
            solidColor.rgb.green = rgb.g;
            solidColor.rgb.blue = rgb.b;
            app.backgroundColor = solidColor;
        }
        
        var files = inputFolder.getFiles(/\.(jpg|jpeg|png|tif|psd|psb)$/i);
        
        if (files.length > 0) {
            var processed = 0;
            var errors = 0;

            for (var i = 0; i < files.length; i++) {
                if (shouldAbortProcessing) {
                    statusText.text = "Proces prerušený. Spracované: " + processed + " súborov, Chyby: " + errors;
                    return;
                }

                try {
                    progressBar.value = (i / files.length) * 100;
                    statusText.text = "Spracovávam: " + files[i].name;

                    var doc = open(files[i]);
                    var docCopy = null;
                    
                    // Process based on fill method
                    if (fillMethod === "normal") {
                        docCopy = resizeAndCenterImage(doc, bgColor);
                    } else if (fillMethod === "contentAware") {
                        docCopy = resizeWithGenerativeExpand(doc);
                    } else if (fillMethod === "crop") {
                        docCopy = cropImage(doc);
                    }

                    // Add watermark if enabled
                    if (docCopy && watermarkSettings && watermarkSettings.enabled && watermarkSettings.file) {
                        docCopy = addWatermark(
                            docCopy, 
                            watermarkSettings.file, 
                            watermarkSettings.opacity,
                            watermarkSettings.blendMode,
                            watermarkSettings.sizing,
                            fillMethod
                        );
                    }

                    if (docCopy) {
                        // Save with settings
                        var saveFile = new File(outputFolder + "/" + files[i].name);
                        var saveOptions = new JPEGSaveOptions();
                        saveOptions.quality = quality;
                        saveOptions.formatOptions = FormatOptions.OPTIMIZEDBASELINE;
                        saveOptions.embedColorProfile = true;
                        docCopy.saveAs(saveFile, saveOptions, true);

                        processed++;
                    }

                    // Cleanup - close both documents
                    if (docCopy) {
                        docCopy.close(SaveOptions.DONOTSAVECHANGES);
                    }
                    if (doc) {
                        doc.close(SaveOptions.DONOTSAVECHANGES);
                    }

                    // Close the saved file if it's open
                    for (var j = 0; j < app.documents.length; j++) {
                        if (app.documents[j].fullName.toString() === saveFile.fullName.toString()) {
                            app.documents[j].close(SaveOptions.DONOTSAVECHANGES);
                            break;
                        }
                    }

                } catch(e) {
                    errors++;
                    alert("Chyba pri spracovaní súboru " + files[i].name + ": " + e);
                }
            }

            progressBar.value = 100;
            statusText.text = "Dokončené! Spracované: " + processed + " súborov, Chyby: " + errors;
        } else {
            alert("V priečinku sa nenašli žiadne platné obrázkové súbory.");
        }
    } catch(e) {
        alert("Chyba: " + e);
    }
}

// =============================================
// VYTVORENIE POUŽÍVATEĽSKÉHO ROZHRANIA
// =============================================

// Vytvorenie hlavného dialógového okna
function createDialog() {
    var dialog = new Window("dialog", "Vermont Insta - Úprava Obrázkov");
    dialog.orientation = "column";
    dialog.alignChildren = "fill";
    
    // Add settings panel
    var settingsPanel = dialog.add("panel", undefined, "Nastavenia");
    settingsPanel.orientation = "column";
    settingsPanel.alignChildren = "fill";
    settingsPanel.margins = 20;

    // Add group for dimensions
    var dimensionsGroup = settingsPanel.add("group");
    dimensionsGroup.orientation = "row";
    dimensionsGroup.add("statictext", undefined, "Rozmery:");
    var widthInput = dimensionsGroup.add("edittext", undefined, targetWidth);
    widthInput.characters = 5;
    dimensionsGroup.add("statictext", undefined, "x");
    var heightInput = dimensionsGroup.add("edittext", undefined, targetHeight);
    heightInput.characters = 5;
    dimensionsGroup.add("statictext", undefined, "pixelov");

    // Add fill method panel
    var fillMethodPanel = settingsPanel.add("panel", undefined, "Spôsob Vyplnenia");
    fillMethodPanel.orientation = "column";
    fillMethodPanel.alignChildren = "left";
    fillMethodPanel.margins = 15;

    // Create a dropdown for fill options with descriptive labels
    var fillMethodDropdown = fillMethodPanel.add("dropdownlist", undefined, [
        "Normálne Vyplnenie - Zmena veľkosti a pridanie farby pozadia (Ostatné brandy)", 
        "Orezanie - Prispôsobenie šírke a orezanie výšky (GANT situácia)", 
        "Generatívne Rozšírenie - Vyplnenie rozšírených oblastí pomocou AI"
    ]);
    fillMethodDropdown.selection = 0; // Set default to Normal Fill
    
    // Add method description text
    var methodDescriptionText = fillMethodPanel.add("statictext", undefined, "Normálne Vyplnenie: Zachová celý obrázok a pridá farbu pozadia");
    methodDescriptionText.preferredSize.width = 350;
    
    // Update method description when selection changes
    fillMethodDropdown.onChange = function() {
        // Show background color panel only for Normal Fill
        bgColorPanel.visible = (fillMethodDropdown.selection.index === 0);
        
        // Update method description
        switch(fillMethodDropdown.selection.index) {
            case 0:
                methodDescriptionText.text = "Normálne Vyplnenie: Zachová celý obrázok a pridá farbu pozadia";
                break;
            case 1:
                methodDescriptionText.text = "Orezanie: Prispôsobí šírke a oreže prebytočnú výšku zhora a zdola";
                break;
            case 2:
                methodDescriptionText.text = "Generatívne Rozšírenie: Používa AI na vyplnenie rozšírených oblastí";
                break;
        }
    };

    // Add background color panel
    var bgColorPanel = settingsPanel.add("panel", undefined, "Farba Pozadia");
    bgColorPanel.orientation = "column";
    bgColorPanel.alignChildren = "left";
    bgColorPanel.margins = 15;

    // Add a note about which methods use background color
    var bgColorNote = bgColorPanel.add("statictext", undefined, "Používa sa len pre Normálne Vyplnenie");
    bgColorNote.graphics.foregroundColor = bgColorNote.graphics.newPen(bgColorNote.graphics.PenType.SOLID_COLOR, [0.5, 0.5, 0.5], 1);

    // Add hex input group
    var hexGroup = bgColorPanel.add("group");
    hexGroup.orientation = "row";
    hexGroup.add("statictext", undefined, "Hex:");
    var bgColorInput = hexGroup.add("edittext", undefined, defaultBgColor);
    bgColorInput.characters = 7;

    // Add RGB input group
    var rgbGroup = bgColorPanel.add("group");
    rgbGroup.orientation = "row";
    rgbGroup.spacing = 5;
    rgbGroup.add("statictext", undefined, "RGB:");
    
    var defaultRgb = hexToRgb(defaultBgColor);
    var rInput = rgbGroup.add("edittext", undefined, defaultRgb.r);
    rInput.characters = 3;
    rgbGroup.add("statictext", undefined, ",");
    var gInput = rgbGroup.add("edittext", undefined, defaultRgb.g);
    gInput.characters = 3;
    rgbGroup.add("statictext", undefined, ",");
    var bInput = rgbGroup.add("edittext", undefined, defaultRgb.b);
    bInput.characters = 3;

    // Add color preview
    var colorPreview = bgColorPanel.add("group");
    colorPreview.size = [50, 30];
    colorPreview.backgroundColor = defaultBgColor;

    // Update color preview and values when hex changes
    bgColorInput.onChanging = function() {
        var hex = bgColorInput.text;
        if (isValidHex(hex)) {
            colorPreview.backgroundColor = hex;
            var rgb = hexToRgb(hex);
            rInput.text = rgb.r;
            gInput.text = rgb.g;
            bInput.text = rgb.b;
        }
    };

    // Update color preview and hex when RGB changes
    function updateFromRGB() {
        var r = parseInt(rInput.text);
        var g = parseInt(gInput.text);
        var b = parseInt(bInput.text);
        
        if (isValidRGB(r) && isValidRGB(g) && isValidRGB(b)) {
            var hex = rgbToHex(r, g, b);
            bgColorInput.text = hex;
            colorPreview.backgroundColor = hex;
        }
    }

    rInput.onChanging = updateFromRGB;
    gInput.onChanging = updateFromRGB;
    bInput.onChanging = updateFromRGB;

    // Add quality slider
    var qualityGroup = settingsPanel.add("group");
    qualityGroup.orientation = "row";
    qualityGroup.add("statictext", undefined, "Kvalita JPEG:");
    var qualitySlider = qualityGroup.add("slider", undefined, 12, 1, 12);
    var qualityValue = qualityGroup.add("statictext", undefined, "12");
    qualitySlider.onChanging = function() {
        qualityValue.text = Math.round(qualitySlider.value);
    };

    // Add watermark panel
    var watermarkPanel = dialog.add("panel", undefined, "Vodoznak");
    watermarkPanel.orientation = "column";
    watermarkPanel.alignChildren = "fill";
    watermarkPanel.margins = 20;

    // Enable watermark checkbox
    var enableWatermarkGroup = watermarkPanel.add("group");
    enableWatermarkGroup.orientation = "row";
    var enableWatermark = enableWatermarkGroup.add("checkbox", undefined, "Povoliť vodoznak");
    enableWatermark.value = false;

    // Watermark file selection
    var watermarkFileGroup = watermarkPanel.add("group");
    watermarkFileGroup.orientation = "column";
    watermarkFileGroup.alignChildren = "fill";
    
    watermarkFileGroup.add("statictext", undefined, "Súbor vodoznaku:");
    var watermarkFilePath = watermarkFileGroup.add("statictext", undefined, "Žiadny súbor nie je vybraný");
    watermarkFilePath.alignment = "left";

    var selectWatermarkButton = watermarkFileGroup.add("button", undefined, "Vybrať súbor vodoznaku");
    selectWatermarkButton.size = [undefined, 35];
    selectWatermarkButton.enabled = false;

    // Watermark options group
    var watermarkOptionsGroup = watermarkPanel.add("group");
    watermarkOptionsGroup.orientation = "column";
    watermarkOptionsGroup.alignChildren = "fill";
    watermarkOptionsGroup.enabled = false;

    // Add watermark sizing options
    var sizingGroup = watermarkOptionsGroup.add("panel", undefined, "Veľkosť vodoznaku");
    sizingGroup.orientation = "row";
    sizingGroup.alignChildren = "left";
    sizingGroup.margins = 15;
    
    var originalSize = sizingGroup.add("radiobutton", undefined, "Originál");
    var containSize = sizingGroup.add("radiobutton", undefined, "Prispôsobiť (Contain)");
    var coverSize = sizingGroup.add("radiobutton", undefined, "Vyplniť (Cover)");
    
    // Set default option
    originalSize.value = true;
    
    // Add handlers for radio buttons
    originalSize.onClick = function() {
        watermarkSizing = "original";
    };
    
    containSize.onClick = function() {
        watermarkSizing = "contain";
    };
    
    coverSize.onClick = function() {
        watermarkSizing = "cover";
    };

    // Opacity option
    var opacityGroup = watermarkOptionsGroup.add("group");
    opacityGroup.orientation = "row";
    opacityGroup.add("statictext", undefined, "Priehľadnosť (%):");
    var opacitySlider = opacityGroup.add("slider", undefined, 100, 10, 100);
    var opacityValue = opacityGroup.add("statictext", undefined, "100");
    opacitySlider.onChanging = function() {
        opacityValue.text = Math.round(opacitySlider.value);
        watermarkOpacity = Math.round(opacitySlider.value);
    };

    // Add Blend Mode option
    var blendModeGroup = watermarkOptionsGroup.add("group");
    blendModeGroup.orientation = "row";
    blendModeGroup.add("statictext", undefined, "Režim prelínania:");
    var blendModeDropdown = blendModeGroup.add("dropdownlist", undefined, [
        "Normálny",
        "Rozptýliť",
        "Násobiť",
        "Prekrytie",
        "Jemné svetlo",
        "Tvrdé svetlo",
        "Rozdiel",
        "Vylúčenie",
        "Závoj",
        "Lineárne svetlo",
        "Bodové svetlo",
        "Stmaviť",
        "Zosvetliť"
    ]);
    blendModeDropdown.selection = 0; // Set default to normal

    // Map dropdown selection to blend mode values
    blendModeDropdown.onChange = function() {
        switch(blendModeDropdown.selection.index) {
            case 0: watermarkBlendMode = "normal"; break;
            case 1: watermarkBlendMode = "dissolve"; break;
            case 2: watermarkBlendMode = "multiply"; break;
            case 3: watermarkBlendMode = "overlay"; break;
            case 4: watermarkBlendMode = "softLight"; break;
            case 5: watermarkBlendMode = "hardLight"; break;
            case 6: watermarkBlendMode = "difference"; break;
            case 7: watermarkBlendMode = "exclusion"; break;
            case 8: watermarkBlendMode = "screen"; break;
            case 9: watermarkBlendMode = "linearLight"; break;
            case 10: watermarkBlendMode = "pinLight"; break;
            case 11: watermarkBlendMode = "darken"; break;
            case 12: watermarkBlendMode = "lighten"; break;
        }
    };

    // Handle watermark checkbox change
    enableWatermark.onClick = function() {
        selectWatermarkButton.enabled = enableWatermark.value;
        watermarkOptionsGroup.enabled = enableWatermark.value && watermarkFile !== null;
    };

    // Handle watermark file selection
    selectWatermarkButton.onClick = function() {
        var supportedExtensions = "*.png;*.jpg;*.jpeg;*.psd;*.psb;*.ai;*.svg";
        watermarkFile = File.openDialog("Vybrať súbor vodoznaku", supportedExtensions, false);
        if (watermarkFile !== null) {
            watermarkFilePath.text = watermarkFile.fsName;
            watermarkOptionsGroup.enabled = true;
        }
    };

    // Add folder selection panel
    var folderPanel = dialog.add("panel", undefined, "Výber Priečinkov");
    folderPanel.orientation = "column";
    folderPanel.alignChildren = "fill";
    folderPanel.margins = 20;

    // Input folder group
    var inputFolderGroup = folderPanel.add("group");
    inputFolderGroup.orientation = "column";
    inputFolderGroup.alignChildren = "fill";
    
    inputFolderGroup.add("statictext", undefined, "Vstupný Priečinok:");
    var inputFolderPath = inputFolderGroup.add("statictext", undefined, "Žiadny priečinok nie je vybraný");
    inputFolderPath.alignment = "left";

    var selectInputButton = inputFolderGroup.add("button", undefined, "Vybrať Vstupný Priečinok");
    selectInputButton.size = [undefined, 35];

    // Output folder group
    var outputFolderGroup = folderPanel.add("group");
    outputFolderGroup.orientation = "column";
    outputFolderGroup.alignChildren = "fill";
    
    outputFolderGroup.add("statictext", undefined, "Výstupný Priečinok:");
    var outputFolderPath = outputFolderGroup.add("statictext", undefined, "Žiadny priečinok nie je vybraný");
    outputFolderPath.alignment = "left";

    var outputOptions = outputFolderGroup.add("group");
    outputOptions.orientation = "row";
    outputOptions.alignChildren = "center";
    
    var useInputFolder = outputOptions.add("radiobutton", undefined, "Použiť Vstupný Priečinok");
    var useCustomFolder = outputOptions.add("radiobutton", undefined, "Vlastný Priečinok");
    useInputFolder.value = true;

    var selectOutputButton = outputFolderGroup.add("button", undefined, "Vybrať Výstupný Priečinok");
    selectOutputButton.size = [undefined, 35];
    selectOutputButton.enabled = false;

    // Handle radio button changes
    useInputFolder.onClick = function() {
        selectOutputButton.enabled = false;
        if (selectedInputFolder) {
            var timestamp = getTimestamp();
            outputFolderPath.text = selectedInputFolder.fsName + "/spracovane_" + timestamp;
        }
    };

    useCustomFolder.onClick = function() {
        selectOutputButton.enabled = true;
    };

    var selectedInputFolder = null;
    var selectedOutputFolder = null;

    // Handle the input folder selection
    selectInputButton.onClick = function() {
        selectedInputFolder = Folder.selectDialog("Vybrať vstupný priečinok");
        if (selectedInputFolder != null) {
            inputFolderPath.text = selectedInputFolder.fsName;
            if (useInputFolder.value) {
                var timestamp = getTimestamp();
                outputFolderPath.text = selectedInputFolder.fsName + "/spracovane_" + timestamp;
            }
            runButton.enabled = true;
        }
    };

    // Handle the output folder selection
    selectOutputButton.onClick = function() {
        selectedOutputFolder = Folder.selectDialog("Vybrať výstupný priečinok");
        if (selectedOutputFolder != null) {
            outputFolderPath.text = selectedOutputFolder.fsName;
        }
    };

    // Add execution panel
    var executionPanel = dialog.add("panel", undefined, "Spustenie");
    executionPanel.orientation = "column";
    executionPanel.alignChildren = "fill";
    executionPanel.margins = 20;

    // Add progress bar
    var progressBar = executionPanel.add("progressbar", undefined, 0, 100);
    progressBar.size = [300, 10];

    // Add status text
    var statusText = executionPanel.add("statictext", undefined, "Pripravené na spracovanie...");
    statusText.alignment = "left";

    // Add button group
    var buttonGroup = executionPanel.add("group");
    buttonGroup.orientation = "row";
    buttonGroup.alignment = "center";
    buttonGroup.spacing = 10;
    
    var cancelButton = buttonGroup.add("button", undefined, "Zrušiť");
    cancelButton.size = [120, 35];
    var abortButton = buttonGroup.add("button", undefined, "Prerušiť Spracovanie");
    abortButton.size = [120, 35];
    abortButton.enabled = false;
    var runButton = buttonGroup.add("button", undefined, "Spustiť Proces");
    runButton.size = [120, 35];
    runButton.enabled = false;

    // Add copyright notice
    var copyrightGroup = dialog.add("group");
    copyrightGroup.orientation = "row";
    copyrightGroup.alignment = "center";
    var copyrightText = copyrightGroup.add("statictext", undefined, "© " + new Date().getFullYear() + " Vermont Services Slovakia");
    copyrightText.graphics.foregroundColor = copyrightText.graphics.newPen(copyrightText.graphics.PenType.SOLID_COLOR, [0.5, 0.5, 0.5], 1);

    // Handle the abort button click
    abortButton.onClick = function() {
        shouldAbortProcessing = true;
        statusText.text = "Prerušenie spracovania...";
        abortButton.enabled = false;
    };

    // Update run button click handler
    runButton.onClick = function() {
        // Validate background color for methods that use it
        if (fillMethodDropdown.selection.index === 0) {
            if (!isValidHex(bgColorInput.text)) {
                alert("Prosím zadajte platnú hex farbu (napr. #FFFFFF) pre pozadie");
                return;
            }
        }

        // Validate watermark if enabled
        if (enableWatermark.value && watermarkFile === null) {
            alert("Prosím vyberte súbor vodoznaku alebo vypnite funkciu vodoznaku");
            return;
        }

        var outputFolder;
        if (useInputFolder.value) {
            var timestamp = getTimestamp();
            outputFolder = new Folder(selectedInputFolder.fsName + "/spracovane_" + timestamp);
            // Update the displayed path with the current timestamp
            outputFolderPath.text = outputFolder.fsName;
        } else {
            outputFolder = selectedOutputFolder;
        }

        if (!outputFolder) {
            alert("Prosím vyberte výstupný priečinok");
            return;
        }

        // Reset abort flag and enable abort button
        shouldAbortProcessing = false;
        abortButton.enabled = true;
        runButton.enabled = false;
        cancelButton.enabled = false;

        // Create output folder if it doesn't exist
        if (!outputFolder.exists) {
            outputFolder.create();
        }

        targetWidth = parseInt(widthInput.text);
        targetHeight = parseInt(heightInput.text);
        
        var fillMethod;
        switch(fillMethodDropdown.selection.index) {
            case 0: fillMethod = "normal"; break;
            case 1: fillMethod = "crop"; break;
            case 2: fillMethod = "contentAware"; break;
        }
        
        // Create watermark settings object
        var watermarkSettings = {
            enabled: enableWatermark.value,
            file: watermarkFile,
            opacity: watermarkOpacity,
            blendMode: watermarkBlendMode,
            sizing: watermarkSizing
        };
        
        processFolder(selectedInputFolder, outputFolder, parseInt(qualityValue.text), progressBar, statusText, bgColorInput.text, fillMethod, watermarkSettings);

        // Re-enable buttons after processing
        abortButton.enabled = false;
        runButton.enabled = true;
        cancelButton.enabled = true;
    };

    // Handle the cancel button click
    cancelButton.onClick = function() {
        dialog.close();
    };

    return dialog;
}

// =============================================
// SPUSTENIE SKRIPTU
// =============================================

// Zobrazenie dialógového okna
var dialog = createDialog();
dialog.show();
