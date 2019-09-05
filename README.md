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
