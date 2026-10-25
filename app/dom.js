/* Kiln · the page's elements by id. Its own file, importing nothing: modules that use $ while they load can never
   meet it unready (a module in an import circle may run before its partners) */
export const $ = id => document.getElementById(id);
