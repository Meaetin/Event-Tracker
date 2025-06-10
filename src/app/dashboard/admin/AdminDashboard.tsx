import { Button, HStack } from "@chakra-ui/react"

export default function AdminDashboard() {




  return (
    <>
    <HStack>
      <Button>Click me</Button>
      <Button>Click me</Button>
    </HStack>
    <div className="title-container container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>
    </div>

    <div className="events-container container w-vw mx-auto px-4 py-8 bg-white shadow rounded-lg p-6 mb-6">
      <h2 className="text-xl font-bold">Event Management</h2>
      <div className="listings-container bg-white shadow rounded-lg p-6 mb-6">hello</div>
    </div>

    </>
  );
}