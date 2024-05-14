import * as React from 'react';

import { createRoot } from 'react-dom/client';
import { Visualize } from './Visualize';

createRoot(document.getElementById('app')!).render(<Visualize />);
