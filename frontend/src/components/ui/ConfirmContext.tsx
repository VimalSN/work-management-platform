import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from './Button';

type ConfirmOptions = { title: string; message: string; danger?: boolean };
type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ options: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      setState({ options, resolve });
    });
  }, []);

  function handleClose(result: boolean) {
    state?.resolve(result);
    setState(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-5 space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">{state.options.title}</h2>
            <p className="text-sm text-slate-600">{state.options.message}</p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button variant={state.options.danger ? 'danger' : 'primary'} onClick={() => handleClose(true)}>
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return ctx;
}
