/**
 * Simple shared callback bus for PageSelector -> App communication.
 * Both are in the same webpack bundle so they share this module instance.
 */
const bus = {
  handler: null
};

export default bus;
