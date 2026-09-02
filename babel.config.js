module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    // Must be listed last — react-native-reanimated v4 delegates its
    // worklet transform to this package (split out from reanimated core).
    plugins: ["react-native-worklets/plugin"],
  };
};
