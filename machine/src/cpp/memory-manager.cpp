#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include <vector>
#include <memory>

namespace py = pybind11;

// Gerenciador de memória para os nós do grafo
class NodeMemoryManager
{
private:
  std::vector<std::unique_ptr<float[]>> buffers;
  size_t buffer_size;

public:
  NodeMemoryManager(size_t size) : buffer_size(size) {}

  // Aloca buffer para armazenar embeddings de um nó
  int allocate_buffer()
  {
    buffers.push_back(std::make_unique<float[]>(buffer_size));
    return buffers.size() - 1;
  }

  void set_value(int idx, size_t pos, float val)
  {
    if (idx < buffers.size() && pos < buffer_size)
      buffers[idx][pos] = val;
  }

  float get_value(int idx, size_t pos)
  {
    if (idx < buffers.size() && pos < buffer_size)
      return buffers[idx][pos];
    return 0.0f;
  }

  void free_buffer(int idx)
  {
    if (idx < buffers.size())
      buffers[idx].reset();
  }

  size_t total_allocated() const { return buffers.size() * buffer_size * sizeof(float); }
};

PYBIND11_MODULE(memory_manager, m)
{
  m.doc() = "Gerenciador de memória C++ para a rede neural";

  py::class_<NodeMemoryManager>(m, "NodeMemoryManager")
      .def(py::init<size_t>())
      .def("allocate_buffer", &NodeMemoryManager::allocate_buffer)
      .def("set_value", &NodeMemoryManager::set_value)
      .def("get_value", &NodeMemoryManager::get_value)
      .def("free_buffer", &NodeMemoryManager::free_buffer)
      .def("total_allocated", &NodeMemoryManager::total_allocated);
}