import { createContext } from 'react';
/**
 * `StderrContext` is a React context, which exposes stderr stream.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
const StderrContext = createContext({
    stderr: undefined,
    write() { }
});
StderrContext.displayName = 'InternalStderrContext';
export default StderrContext;
//# sourceMappingURL=StderrContext.js.map