export default function handler(req: any, res: any) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json')
  res.json({ name: 'John Doe' })
}
