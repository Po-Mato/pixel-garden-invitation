import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CommonPagesAnalytics } from './CommonPagesAnalytics';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('shows missing history separately, uses the existing token, and refreshes on request',async()=>{
 const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({blogEnabledAt:'2026-10-05T00:00:00Z',totals:{blog:2,wedding:5,recordedTotal:7,complete:false},days:[{day:'2026-10-04',blog:null,wedding:5,recordedTotal:5,complete:false}]})});vi.stubGlobal('fetch',fetcher);
 const props={token:'local-test-token',from:'2026-10-04',to:'2026-10-05'};
 const {rerender}=render(<CommonPagesAnalytics {...props} refreshKey={1}/>);
 expect(await screen.findByText('미수집')).toBeTruthy();expect(screen.getByText(/기록된 합계 7/)).toBeTruthy();expect(screen.getByText(/완전한 합계가 아닙니다/)).toBeTruthy();
 expect(fetcher.mock.calls[0][1].headers.authorization).toBe('Bearer local-test-token');
 rerender(<CommonPagesAnalytics {...props} refreshKey={2}/>);await waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(2));
});
it('keeps the surrounding admin page usable when collection is unavailable',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:503}));render(<CommonPagesAnalytics token="local" from="2026-10-04" to="2026-10-05"/>);expect(await screen.findByRole('status')).toHaveTextContent('불러오지 못했습니다');
});
