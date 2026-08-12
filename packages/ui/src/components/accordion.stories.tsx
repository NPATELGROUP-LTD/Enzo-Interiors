import type { Meta, StoryObj } from '@storybook/react-vite';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './accordion';

const meta: Meta<typeof Accordion> = {
  title: 'Components/Accordion',
  component: Accordion,
};
export default meta;

type Story = StoryObj<typeof Accordion>;

export const FAQ: Story = {
  render: () => (
    <Accordion type="single" collapsible style={{ width: 400 }}>
      <AccordionItem value="q1">
        <AccordionTrigger>Do you offer free consultations?</AccordionTrigger>
        <AccordionContent>Yes, the first consultation is always free and comes with no obligation.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="q2">
        <AccordionTrigger>How long does a typical kitchen installation take?</AccordionTrigger>
        <AccordionContent>Most kitchen installations take 2–4 weeks depending on scope.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="q3">
        <AccordionTrigger>Do you provide 3D renders?</AccordionTrigger>
        <AccordionContent>We price and schedule design work, but do not generate 3D models on this platform.</AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};
