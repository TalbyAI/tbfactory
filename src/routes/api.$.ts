import { createFileRoute } from '@tanstack/react-router';
import { errorResponse, handleHttp } from '../server/http';
import { getServices } from '../server/services';

async function handle({ request }: { request: Request }) {
  try {
    return await handleHttp(request, await getServices());
  } catch (error) {
    return errorResponse(error);
  }
}
export const Route = createFileRoute('/api/$')({
  server: { handlers: { GET: handle, POST: handle, PUT: handle, PATCH: handle, DELETE: handle } },
});
