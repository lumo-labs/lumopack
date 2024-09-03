#! /usr/bin/env node
import { program } from "commander";
import figlet from "figlet";
import archiver from "archiver";
import fs from "fs-extra";
import path from "path";
import uglify from "uglify-js";

console.log(figlet.textSync("lumoPACK", { horizontalLayout: "full" }));
/**
 * Finds file in the given directory
 * @param {string} dir Specified directory
 * @param {Array<string>} names File name to look for
 */
export const findFiles = (dir, names) => {
  let results = [];
  const list = fs.readdirSync(dir);

  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat && stat.isDirectory()) {
      results = results.concat(findFiles(filePath, names));
    } else if (names.includes(file)) {
      results.push(filePath);
    }
  });

  return results;
};

export const minify = (filePath) => {
  const code = fs.readFileSync(filePath, "utf8");
  const res = uglify.minify(code);

  if (res.error) {
    console.error(`Error minifying ${filePath}:`, res.error);
    process.exit(1);
  }

  return res.code;
};

program
  .version("1.0.0")
  .description("clean up files and package them for release")
  .option("-d, --dir <directory>", "The directory to look for files")
  .option("-h, --html <file>", "The HTML file to be cleaned")
  .option("-c, --css <file>", "The CSS file to be cleaned")
  .option("-js, --js <file>", "The JS file to be cleaned")
  .option("-j, --json <file>", "The JSON file to be cleaned")
  .action(({ dir, html, css, js, json }) => {
    const files = findFiles(dir, [html, css, js, json]);
    const newName = path
      .basename(dir)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");

    const output = fs.createWriteStream(`${newName}.zip`);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      console.log(`Zipped file size: ${archive.pointer()}`);
    });

    archive.on("error", (e) => {
      throw e;
    });

    archive.pipe(output);

    if (files.length === 0) {
      console.log("No files found");
      return;
    }

    const ignore = [".json", ".css", ".html"];

    files.forEach((file) => {
      const minified = ignore.includes(path.extname(file))
        ? fs.readFileSync(file, "utf8")
        : minify(file);

      const fileName = `${newName}${path.extname(file)}`;
      archive.append(minified, { name: fileName });
    });

    archive.finalize();
    console.log(`All files minified and zipped: ${newName}.zip`);
  });
program.parse(process.argv);
