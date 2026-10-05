import { useEffect, useState } from 'react';
type Counts = { from: string; to: string; blogEnabledAt: string | null; days: { day: string; blog: number | null; wedding: number | null; recordedTotal: number; complete: boolean }[]; totals: { blog: number; wedding: number; recordedTotal: number; complete: boolean } };
export function CommonPagesAnalytics({ token, from, to, refreshKey }: { token: string; from: string; to: string; refreshKey?: unknown }) {
  const [data, setData] = useState<Counts | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    const base = (import.meta.env.VITE_WORKER_URL ?? '').replace(/\/+$/, '');
    const url = `${base}/api/invitations/sample-garden/admin/pages-analytics?${new URLSearchParams({ from, to })}`;
    void fetch(url, { headers: { authorization: `Bearer ${token}` }, signal: abort.signal, cache: 'no-store' })
      .then(async r => { if (!r.ok) throw Error(); return r.json() as Promise<Counts>; })
      .then(result => { if (!abort.signal.aborted) { setData(result); setError(''); } })
      .catch(() => { if (!abort.signal.aborted) { setData(null); setError('공통 방문 통계를 불러오지 못했습니다.'); } });
    return () => abort.abort();
  }, [token, from, to, refreshKey]);
  return <section className="analytics-section" aria-label="전체 Pages 방문 통계">
    <h2>전체 GitHub Pages 방문</h2>
    <p>한국시간 · 페이지를 새로 연 횟수입니다. 합계는 고유 방문자 수가 아닙니다.</p>
    {error ? <p role="status">{error}</p> : !data ? <p>집계를 불러오는 중입니다.</p> : <>
      <p>블로그 {data.totals.blog.toLocaleString()}회 · 청첩장 {data.totals.wedding.toLocaleString()}회 · 기록된 합계 {data.totals.recordedTotal.toLocaleString()}회</p>
      {!data.totals.complete && <p>미수집 기간이 포함되어 전체 기간의 완전한 합계가 아닙니다.</p>}
      <p>블로그 수집 준비 시각: {data.blogEnabledAt ? new Date(data.blogEnabledAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '미수집'}</p>
      <details><summary>사이트별 일별 내역</summary>
        <table><thead><tr><th scope="col">날짜</th><th scope="col">블로그</th><th scope="col">청첩장</th><th scope="col">기록 합계</th></tr></thead>
          <tbody>{data.days.map(d => <tr key={d.day}><th scope="row">{d.day}</th><td>{d.blog ?? '미수집'}</td><td>{d.wedding ?? '미수집'}</td><td>{d.recordedTotal}{!d.complete && ' (일부)'}</td></tr>)}</tbody></table>
      </details>
    </>}
  </section>;
}
