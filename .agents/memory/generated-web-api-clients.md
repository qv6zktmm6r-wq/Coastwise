---
name: Generated web API clients
description: TypeScript library settings needed by generated browser API clients.
---

Include the DOM iterable library when type-checking generated browser clients that iterate `Headers`.

**Why:** The API generator can emit `Headers.entries()`. TypeScript recognizes that method through DOM iterable declarations, so code generation may succeed while the shared-library build fails without them.

**How to apply:** After changing the OpenAPI contract, run code generation and the shared-library type check together. If generated fetch code uses browser iterators, keep DOM and DOM iterable libraries enabled for that client package.