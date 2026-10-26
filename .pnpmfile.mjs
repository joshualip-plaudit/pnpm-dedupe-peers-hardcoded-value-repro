export const hooks = {
  readPackage(pkg) {
    return { ...pkg, description: "set by readPackage" };
  },
};
