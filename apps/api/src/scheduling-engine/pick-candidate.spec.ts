import { pickCandidate } from './pick-candidate';

describe('pickCandidate', () => {
  it('returns null when there are no candidates', () => {
    expect(pickCandidate([])).toBeNull();
  });

  it('returns the only candidate when there is exactly one', () => {
    expect(pickCandidate(['a'])).toBe('a');
  });

  it('picks the candidate at the index derived from the injected random function', () => {
    expect(pickCandidate(['a', 'b', 'c'], () => 0)).toBe('a');
    expect(pickCandidate(['a', 'b', 'c'], () => 0.34)).toBe('b');
    expect(pickCandidate(['a', 'b', 'c'], () => 0.99)).toBe('c');
  });
});
