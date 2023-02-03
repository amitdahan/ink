import React, {useState, useRef, useEffect, FC} from 'react';
import test from 'ava';
import delay from 'delay';
import {Box, Text, render, measureElement} from '../src/index.js';
import createStdout from './helpers/create-stdout.js';

test('measure element', async t => {
	const stdout = createStdout();

	const Test: FC = () => {
		const [width, setWidth] = useState(0);
		const ref = useRef();

		useEffect(() => {
			setWidth(measureElement(ref.current as any).width);
		}, []);

		return (
			// @ts-ignore
			<Box ref={ref}>
				<Text>Width: {width}</Text>
			</Box>
		);
	};

	render(<Test />, {stdout: stdout as any, debug: true});
	t.is((stdout.write as any).firstCall.args[0], 'Width: 0');
	await delay(100);
	t.is((stdout.write as any).lastCall.args[0], 'Width: 100');
});
