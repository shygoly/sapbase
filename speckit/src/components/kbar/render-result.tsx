import { KBarResults, useMatches, ActionImpl } from 'kbar';
import ResultItem from './result-item';

export default function RenderResults() {
  const { results, rootActionId } = useMatches();

  return (
    <KBarResults
      items={results}
      onRender={({ item, active }: { item: string | ActionImpl; active: boolean }) =>
        typeof item === 'string' ? (
          <div className='text-primary-foreground px-4 py-2 text-sm uppercase opacity-50'>
            {item}
          </div>
        ) : (
          <ResultItem
            action={item}
            active={active}
            currentRootActionId={rootActionId ?? ''}
          />
        )
      }
    />
  );
}
