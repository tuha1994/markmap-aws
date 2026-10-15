import { describe, expect, it } from 'vitest';

import { makeMindMap } from '../../test/factories';
import { searchMindMaps } from './search';

describe('searchMindMaps', () => {
  it('ranks exact and prefix title matches above Markdown content matches', () => {
    const exactTitle = makeMindMap({ title: 'AWS network', markdown: '# unrelated' });
    const prefixTitle = makeMindMap({ title: 'AWS networking notes', markdown: '# unrelated' });
    const contentOnly = makeMindMap({ title: 'Infrastructure', markdown: '# AWS network design' });

    expect(searchMindMaps([contentOnly, prefixTitle, exactTitle], 'aws network').map((result) => result.map)).toEqual([
      exactTitle,
      prefixTitle,
      contentOnly
    ]);
  });

  it('searches only maps supplied by the owner-scoped subscription', () => {
    const ownerMap = makeMindMap({ title: 'Owner architecture', markdown: '# private network' });
    const absentOtherOwnerMap = makeMindMap({ ownerUid: 'other-owner', title: 'Other owner architecture' });

    const results = searchMindMaps([ownerMap], 'architecture');

    expect(results.map((result) => result.map)).toEqual([ownerMap]);
    expect(results.map((result) => result.map)).not.toContain(absentOtherOwnerMap);
  });

  it('normalizes title and Markdown text locally before matching', () => {
    const map = makeMindMap({ title: 'Café plan', markdown: '# Réseau privé' });

    expect(searchMindMaps([map], 'CAFE').map((result) => result.map)).toEqual([map]);
    expect(searchMindMaps([map], 'reseau').map((result) => result.map)).toEqual([map]);
  });
});
