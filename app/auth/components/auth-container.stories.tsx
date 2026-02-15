import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AuthContainer } from "./auth-container";

const meta: Meta<typeof AuthContainer> = {
  title: "Auth/AuthContainer",
  component: AuthContainer,
};

export default meta;

type Story = StoryObj<typeof AuthContainer>;

export const Default: Story = {
  render: () => (
    <AuthContainer>
      <div className='rounded-xl bg-white p-6 shadow-sm dark:bg-slate-800'>
        Auth content preview
      </div>
    </AuthContainer>
  ),
};
