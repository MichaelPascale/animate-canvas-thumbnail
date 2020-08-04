#!/bin/env node

/* index.js
   Thumbnail generator for Animate HTML5 Canvas projects that export to EaselJS.
   
   Copyright (c) 2020, Michael Pascale
   All rights reserved.
*/

const fs = require('fs');
const path = require('path');

const puppeteer = require('puppeteer');
const node_canvas = require('canvas');
const { Buffer } = require('buffer');

// Default CreateJS path.
let createPath = path.join(__dirname, 'lib/createjs.min.js');

/**
 * Generate a thumbnail of an Animate canvas object.
 * @param {String} assetPath Path of the Animate-published JavaScript.
 * @param {Object} options Thumbnail options.
 * @return Image data encoded in base64 as a data URL.
 */
async function GenThumbnail(assetPath, options) {
    const {
        width = 200,
        height = 113,
        scale = 0.104,
        stopPoint = 1 / 8,
        imageType = 'image/jpeg',
        imageQuality = 0.6,
        puppeteerTimeout = 5000,
        puppeteerDevtools = false,
        exec = ()=> 0
    } = options || {};

    try {
        if (!assetPath) throw Error('No asset path specified.');
        assetPath = path.normalize(assetPath);

        if (assetPath.match(/\.js$/)) {
            // Load CreateJS library and Animate asset as text.
            let create = fs.readFileSync(createPath, { encoding: 'utf-8' });
            let asset = fs.readFileSync(assetPath, { encoding: 'utf-8' });

            // Lunch headless Chrome with Puppeteer
            const browser = await puppeteer.launch({ devtools: puppeteerDevtools, timeout: puppeteerTimeout });

            const page = await browser.newPage();
            page.on('console', msg => console.log('Puppeteer:', msg.text()));

            // Evaluate CreateJS library and asset.
            await page.evaluate(create);
            await page.evaluate(exec);
            await page.evaluate(asset);

            // Generate thumbnail;
            let result = await page.evaluate(inBrowser, assetPath, { width, height, scale, stopPoint, imageType, imageQuality });
            await browser.close();

            if (result == null) throw Error('An error occured generating the image.')
            return result;

        } else if (assetPath.match(/(\.png|\.jpg|\.jpeg)$/)) {
            // If the input is already an image file, just resize it.
            const canvas = node_canvas.createCanvas(width, height);
            const image = await node_canvas.loadImage(assetPath);
            canvas.getContext('2d').drawImage(image, 0, 0, width, height);

            // Generate thumbnail.
            return canvas.toDataURL(imageType, imageQuality);

        } else throw Error("Asset must be JavaScript or an image.");
    } catch (err) {
        console.error(`GenThumbnail: ${err.message}`);
        return "";
    }
};

/**
 * Write JPEG image encoded as a data URL (e.g. from GenThumbnail) to a file.
 * Fails silently.
 * @param {String} dataurl 
 * @return dataurl as passed in.
 */
function DataURLToImage(dataurl, imagePath) {
    let data = dataurl.match(/^data:image\/jpeg;base64,(.*)$/);
    try {
        if (data.length === 2) {
            fs.writeFileSync(imagePath, Buffer.from(data[1], 'base64'));
        }
    } catch (err) {
        console.error(`DataURLToImage: ${err.message}`);
    }
    return dataurl;
}

// Use CreateJS to render the thumbnail in Chromium.
function inBrowser(assetPath, options) {

    let canvas = document.createElement("canvas");
    canvas.setAttribute('width', options.width);
    canvas.setAttribute('height', options.height);

    try {
        let stage = new createjs.Stage(canvas);
        stage.scale = options.scale;

        let name = assetPath.replace(/^.*\/|\..*/g, "");
        let id = Object.keys(AdobeAn.compositions)[0];
        let comp = AdobeAn.getComposition(id);
        let lib = comp.getLibrary();

        let clip = new lib[name]();
        clip.gotoAndStop(clip.totalFrames * options.stopPoint);

        stage.addChild(clip);
        stage.update();
        return canvas.toDataURL(options.imageType, options.imageQuality);
    } catch (err) {
        console.log(err.message)
        return null;
    }
}

module.exports = { GenThumbnail, DataURLToImage };
