# modulestrap

<sup>**Social Media Photo by [Danielle MacInnes](https://unsplash.com/@dsmacinnes) on [Unsplash](https://unsplash.com/)**</sup>

A basic JS module bootstrap: `npx modulestrap project-name`

- - -

The goal of this binary module is to bootstrap any JS module that would like to land on browsers, as well as NodeJS.

```
modulestrap project-name
  --babel # to transpile for older browsers
  --cover # to include coverage tools
  --node  # to create a NodeJS only module
  --ungap # to include polyfills
  --force # to overwrite existent projects
```

Accordingly with the passed flags, the binary will create _project-name_ and initialize it with most common tools to create dual modules.

## Example / How to

```sh
npx modulestrap my-project --babel
cd my-project
code .
# write your module in ./esm/ folder
# the `index.js` is already there
# once you've done
npm run build
```

Above procedure will create all files for both CommonJS and ESM module + it will transpile to `index.js` and minify to `min.js` for browsers.

It is suggested to write a _test_ too, either via `--cover` flag, or manually.

At that point, you can publish to npm your module.
