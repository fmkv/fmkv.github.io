import fs from "fs";
import * as sass from "sass";
import path from "path";
import { minify } from "html-minifier";
import imagemin from "imagemin";
import imageminMozjpeg from "imagemin-mozjpeg";
import imageminPngquant from "imagemin-pngquant";
import imageminSvgo from "imagemin-svgo";
import { promisify } from "util";

const siteName = "FMKV";

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const copyFile = promisify(fs.copyFile);
const readdir = promisify(fs.readdir);

// Ensure dist directory exists
const ensureDir = async (dir) => {
  if (!fs.existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
};

// compile Sass
async function compileSass() {
  const result = sass.compile("./src/static/sass/main.scss");
  await ensureDir("./dist/static/css");
  fs.writeFileSync("./dist/static/css/main.css", result.css);
}

async function optimizeImages() {
  await imagemin(["src/static/img/*.{jpg,png,svg}"], {
    destination: "dist/static/img",
    plugins: [
      imageminMozjpeg({ quality: 75 }),
      imageminPngquant({ quality: [0.6, 0.8] }),
      imageminSvgo(),
    ],
  });
}

// Process a page
async function buildPage(file) {
  const pageName = path.basename(file, "-content.html");
  const relative = path.dirname(
    path.relative("./src/content", path.resolve(file))
  );
  console.log(`Building ${pageName}.html...`);

  // Read template files
  const baseTemplate = await readFile("./src/templates/base.html", "utf8");
  const header = await readFile("./src/templates/header.html", "utf8");
  const footer = await readFile("./src/templates/footer.html", "utf8");

  // Read page-specific content
  const contentFile = `./src/content/${relative}/${pageName}-content.html`;
  const pageContent = await readFile(contentFile, "utf8");

  // Assemble the page
  let finalHTML = baseTemplate
    .replace(
      "{{PAGE_TITLE}}",
      pageName === "index" ? siteName : `${siteName} - ${pageName}`
    )
    .replace('<div id="header-container"></div>', header)
    .replace('<div id="content-container"></div>', pageContent)
    .replace('<div id="footer-container"></div>', footer);

  finalHTML = minify(finalHTML, {
    removeComments: true,
    collapseWhitespace: true,
    conservativeCollapse: true,
    minifyJS: true,
    minifyCSS: true,
  });

  // Write output
  await ensureDir(`./dist/${relative}`);
  await writeFile(`./dist/${relative}/${pageName}.html`, finalHTML);
}

// Copy static assets
async function copyStatic() {
  console.log("Copying static files...");
  await ensureDir("./dist/static");

  // Function to copy a directory recursively
  const copyDir = async (src, dest) => {
    await ensureDir(dest);

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await copyDir(srcPath, destPath);
      } else {
        await copyFile(srcPath, destPath);
      }
    }
  };

  await copyDir("./src/static", "./dist/static");
}

async function findContentFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return findContentFiles(fullPath); // recurse
      } else if (entry.name.endsWith("-content.html")) {
        return fullPath;
      }
      return null;
    })
  );
  return files.flat().filter(Boolean);
}

// Main build function
async function build() {
  try {
    // Build each page
    const contentFiles = await findContentFiles("./src/content");
    for (const file of contentFiles) {
      await buildPage(file);
    }

    await compileSass();
    await optimizeImages();

    // Copy static assets
    await copyStatic();

    console.log("Build completed successfully!");
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

// Run the build
build();
