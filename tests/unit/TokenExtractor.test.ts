import { TokenExtractor } from '../../src/core/TokenExtractor';

describe('TokenExtractor', () => {
  let extractor: TokenExtractor;

  beforeEach(() => {
    extractor = new TokenExtractor();
  });

  it('should be instantiable', () => {
    expect(extractor).toBeInstanceOf(TokenExtractor);
  });

  it('should clear cache', () => {
    expect(() => extractor.clearCache()).not.toThrow();
  });
});
