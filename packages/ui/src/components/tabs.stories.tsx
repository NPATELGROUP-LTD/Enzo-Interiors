import type { Meta, StoryObj } from '@storybook/react-vite';

import { Skeleton } from './skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

const meta: Meta<typeof Tabs> = {
  title: 'Components/Tabs',
  component: Tabs,
};
export default meta;

type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="overview" style={{ width: 360 }}>
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="projects">Projects</TabsTrigger>
        <TabsTrigger value="invoices">Invoices</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">Client overview content.</TabsContent>
      <TabsContent value="projects">Client project list.</TabsContent>
      <TabsContent value="invoices">Client invoice history.</TabsContent>
    </Tabs>
  ),
};

export const DisabledTab: Story = {
  render: () => (
    <Tabs defaultValue="overview" style={{ width: 360 }}>
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="invoices" disabled>
          Invoices
        </TabsTrigger>
      </TabsList>
      <TabsContent value="overview">Client overview content.</TabsContent>
    </Tabs>
  ),
};

export const LoadingContent: Story = {
  render: () => (
    <Tabs defaultValue="projects" style={{ width: 360 }}>
      <TabsList>
        <TabsTrigger value="projects">Projects</TabsTrigger>
        <TabsTrigger value="invoices">Invoices</TabsTrigger>
      </TabsList>
      <TabsContent value="projects" className="flex flex-col gap-2">
        <Skeleton style={{ height: 16, width: '60%' }} />
        <Skeleton style={{ height: 16, width: '100%' }} />
        <Skeleton style={{ height: 16, width: '80%' }} />
      </TabsContent>
      <TabsContent value="invoices">Client invoice history.</TabsContent>
    </Tabs>
  ),
};
