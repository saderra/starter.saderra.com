const eleventyNavigationPlugin = require("@11ty/eleventy-navigation")
const now = String(Date.now())
const { minify } = require('html-minifier-terser');
const { DateTime } = require("luxon");
const path = require("path");

module.exports = async function (eleventyConfig) {

  // @11ty/eleventy-plugin-rss and @11ty/eleventy-img are ESM-only; dynamic
  // import keeps the rest of this config file as plain CommonJS.
  const { default: pluginRss } = await import("@11ty/eleventy-plugin-rss");
  const { default: Image } = await import("@11ty/eleventy-img");

  // PLUGINS
  eleventyConfig.addPlugin(eleventyNavigationPlugin);
  eleventyConfig.addPlugin(pluginRss);


  // TAILWIND
  eleventyConfig.addWatchTarget('./tailwind.config.js')
  eleventyConfig.addWatchTarget('./src/assets/css/tailwind.css')

  // PASSTHROUGHS
  eleventyConfig.addPassthroughCopy("./src/assets/images");
  eleventyConfig.addPassthroughCopy("./src/assets/pdf");
  eleventyConfig.addPassthroughCopy("./src/assets/favicons");
  eleventyConfig.addPassthroughCopy("./src/site.webmanifest");
  eleventyConfig.addPassthroughCopy('./src/cms')
  eleventyConfig.addPassthroughCopy("./src/robots.txt");
  eleventyConfig.addPassthroughCopy({ "node_modules/alpinejs/dist/cdn.min.js": "assets/js/alpine.js" });

  // DATE FORMATTING
  eleventyConfig.addFilter('htmlDateString', (dateObj) => {
    return DateTime.fromJSDate(dateObj, {zone: 'utc'}).toFormat('yyyy-LL-dd');
  });

  eleventyConfig.addFilter("postDate", (dateObj) => {
    return DateTime.fromJSDate(dateObj).toLocaleString(DateTime.DATE_MED);
  });

  //My methods
  
  eleventyConfig.addFilter('articlesByCategory', function(category, articleCollection){
    
    let filter = [];

    articleCollection.forEach(article=>{
      article.data.categories.forEach(cat=>{
        if(category == cat){
          filter.push(article);
        }
      })
    })
    return filter;
  })
  eleventyConfig.addCollection("getCat", function(collectionApi) {
    let collection = collectionApi.getFilteredByTag("articles")
    let categories = [];
    collection.forEach(article=>{
      article.data.categories.forEach(cat=>{
        let find = categories.filter((item) => cat == item)
        if(find.length == 0){
          categories.push(cat)
        }
      })
    })
    return categories;
  });


  // SHORTCODES
  eleventyConfig.addShortcode('version', function () { return now  })
  eleventyConfig.addShortcode("year", () => `${new Date().getFullYear()}`);

  // IMAGES (@11ty/eleventy-img)
  //
  // Resolves and transforms a local image (AVIF/WebP + original format, at
  // the given widths) into @11ty/eleventy-img's metadata object. `src` may
  // be either a site-root path (e.g. "/assets/images/foo.jpg", matching how
  // templates already reference passthrough-copied images) or a path
  // relative to the project root.
  async function getImageMetadata(src, widths) {
    const inputPath = src.startsWith("/assets") ? `./src${src}` : src;
    const ext = path.extname(inputPath).slice(1).toLowerCase();
    const originalFormat = ext === "jpg" ? "jpeg" : ext;
    const formats = originalFormat === "png"
      ? ["webp", "png"]
      : ["avif", "webp", originalFormat];

    return Image(inputPath, {
      widths: [...widths, null],
      formats,
      outputDir: "./_site/assets/images/optimized/",
      urlPath: "/assets/images/optimized/",
      sharpJpegOptions: { quality: 80 },
      sharpWebpOptions: { quality: 80 },
      sharpAvifOptions: { quality: 60 },
    });
  }

  // Renders a <picture> (width/height + lazy-loading included) from
  // pre-resolved image metadata. Kept synchronous and separate from image
  // transformation on purpose: Nunjucks doesn't reliably resolve promises
  // returned from shortcodes called inside a {% for %} loop's macro/include
  // body (it silently renders empty output there), so any image used on a
  // listing page should have its metadata precomputed up front (e.g. via
  // `eleventyComputed`) leaving only this synchronous filter to run inside
  // the loop.
  eleventyConfig.addFilter("renderImage", function (metadata, attributes = {}) {
    if (!metadata) return "";
    return Image.generateHTML(metadata, attributes);
  });

  // Same responsive-image output as `renderImage`, for pages that render a
  // local image directly (not from a collection loop), where an async
  // shortcode is safe to call inline.
  eleventyConfig.addNunjucksAsyncShortcode("image", async function (src, alt, options = {}) {
    if (typeof alt !== "string") {
      throw new Error(`Missing \`alt\` text on responsive image for: ${src}`);
    }

    const {
      widths = [400, 800, 1200],
      sizes = "100vw",
      class: className,
      eager = false,
    } = options;

    const metadata = await getImageMetadata(src, widths);

    const imageAttributes = {
      alt,
      sizes,
      loading: eager ? "eager" : "lazy",
      decoding: "async",
    };
    if (className) imageAttributes.class = className;
    if (eager) imageAttributes.fetchpriority = "high";

    return Image.generateHTML(metadata, imageAttributes);
  });

  let markdownIt = require("markdown-it");
  let options = {
    html: true,
    breaks: true,
    linkify: true
  };
  
  eleventyConfig.setLibrary("md", markdownIt(options));


   /* HTML Minifiy */
    eleventyConfig.addTransform('htmlmin', async function (content, outputPath) {
        if (
          process.env.ELEVENTY_PRODUCTION &&
          outputPath &&
          outputPath.endsWith('.html')
        ) {
          return minify(content, {
            useShortDoctype: true,
            removeComments: true,
            collapseWhitespace: true,
          });
        }

        return content
    })

    return { 
        dir: { 
            input: "src",
            output: "_site",
            includes: "_includes",
            layouts: "_includes/layouts"
        },
    };
};
