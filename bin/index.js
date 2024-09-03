#! /usr/bin/env node
import { program } from "commander";
import figlet from "figlet";
import archiver from "archiver";
import fs from "fs-extra";
import path from "path";
import { minify as uglify } from "minify";

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

export const minify = async (filePath) => {
  const res = await uglify(filePath, {
    css: { compatibility: "*" },
    js: {
      type: "terser",
      mangle: false,
      mangleClassNames: false,
      removeConsole: true,
      removeUselessSpread: true,
    },
    html: {
      minifyJS: false,
      minifyCSS: false,
    },
  });

  return res;
};

program
  .version("1.0.0")
  .description("clean up files and package them for release")
  .option("-d, --dir <directory>", "The directory to look for files")
  .option("-h, --html <file>", "The HTML file to be cleaned")
  .option("-c, --css <file>", "The CSS file to be cleaned")
  .option("-js, --js <file>", "The JS file to be cleaned")
  .option("-j, --json <file>", "The JSON file to be cleaned")
  .action(async ({ dir, html, css, js, json }) => {
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

    const ignore = [".json"];

    for (const file of files) {
      const minified = ignore.includes(path.extname(file))
        ? fs.readFileSync(file, "utf8")
        : await minify(file);

      const fileName = `${path.extname(file).substring(1)}.txt`;
      console.log(`${file} ->`, fileName);
      archive.append(minified, { name: fileName });
    }

    archive.finalize();
    console.log(`All files minified and zipped: ${newName}.zip`);
  });
program.parse(process.argv);
