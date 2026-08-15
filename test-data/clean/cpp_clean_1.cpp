#include <vector>
#include <numeric>
int getSum(const std::vector<int>& v) {
    return std::accumulate(v.begin(), v.end(), 0);
}
